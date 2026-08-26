import { NextRequest, NextResponse } from "next/server"

import { checkRateLimit, getRateLimitIp } from "@/lib/rate-limit"
import {
  buildIdempotencyKey,
  parseRespondioEventPayload,
} from "@/lib/respondio-resolution"
import {
  claimWebhookEvent,
  completeWebhookEvent,
  handleAssigneeUpdated,
  handleContactTagUpdated,
  handleConversationClosed,
  handleMessageSent,
  loadRespondioSettings,
  verifySharedSecret,
} from "@/lib/respondio"
import type { EventOutcome } from "@/lib/respondio"

/** `node:crypto` (constant-time compare, sha256) needs the Node runtime. */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Header carrying the shared secret. n8n sets it on the HTTP Request node; the value
 * is the raw secret issued from the Integrations settings page.
 */
const SECRET_HEADER = "x-sims-webhook-secret"

/**
 * POST /api/integrations/respond-io — the single inbound endpoint for all four n8n
 * workflows (Contact Tag Updated, Contact Assignee Updated, Message Sent,
 * Conversation Closed).
 *
 * NOT behind the `sims-auth` cookie, by design: n8n has no session. `middleware.ts`
 * guards only the page prefixes it lists and never matches `/api/*`, so no exclusion
 * is needed — but do not add an `/api` entry there either.
 *
 * Order matters and is deliberate:
 *   1. rate-limit before any database work, so a flood cannot be amplified into
 *      queries (mirrors `api/supportform/submit`, the only other unauthenticated
 *      write endpoint);
 *   2. verify the secret and reject with 401, logging the attempt so probing is
 *      auditable;
 *   3. claim the event by inserting the ledger row first — the UNIQUE index on
 *      `idempotency_key` is what makes n8n's retries safe;
 *   4. only then process.
 *
 * Status codes: 200 for processed / duplicate / ignored / no-op, 400 for a body that
 * will never parse, 401 for a bad secret, 429 when rate-limited, 500 for an
 * unexpected failure so n8n retries — which is safe, because the ledger absorbs the
 * redelivery.
 */
export async function POST(request: NextRequest) {
  const ip = getRateLimitIp(request)
  const rateLimit = await checkRateLimit(`respondio:webhook:${ip}`, 60, 60)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    )
  }

  const rawBody = await request.text()
  let payload: unknown = null
  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = parseRespondioEventPayload(payload)
  const secret = request.headers.get(SECRET_HEADER)
  const { valid, keyId } = await verifySharedSecret(secret)

  if (!valid) {
    // Logged before returning so repeated probing is visible in the event log. The
    // idempotency key falls back to a per-attempt value when the body did not parse,
    // so unparseable junk cannot collide and suppress a later real event.
    await recordRejected(parsed, payload, rawBody)
    return NextResponse.json({ error: "Invalid shared secret." }, { status: 401 })
  }

  if (!parsed.ok) {
    await claimWebhookEvent({
      eventType: "unknown",
      respondioContactId: null,
      idempotencyKey: buildIdempotencyKey({
        eventId: `malformed:${rawBody.slice(0, 200)}`,
        eventType: "contact_tag_updated",
        respondioContactId: "",
        occurredAt: "",
        conversationId: null,
      }),
      payloadRaw: payload,
      secretValid: true,
      initialStatus: "failed",
      errorMessage: parsed.error,
    }).catch((error) => {
      console.error("Failed to log malformed Respond.io event", error)
      return null
    })

    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const event = parsed.value
  const idempotencyKey = buildIdempotencyKey(event)

  const eventRowId = await claimWebhookEvent({
    eventType: event.eventType,
    respondioContactId: event.respondioContactId,
    idempotencyKey,
    payloadRaw: payload,
    secretValid: true,
  })

  if (!eventRowId) {
    return NextResponse.json({ status: "duplicate" })
  }

  try {
    const settings = await loadRespondioSettings()
    const outcome = await dispatch(event, settings.routingTag)

    await completeWebhookEvent(eventRowId, outcome)

    return NextResponse.json({
      status: outcome.status,
      summary: outcome.summary,
      ticketId: outcome.ticketId,
      keyId,
    })
  } catch (error) {
    console.error("Failed to process Respond.io event", error)
    const message = error instanceof Error ? error.message : "Unknown error"

    await completeWebhookEvent(eventRowId, {
      status: "failed",
      summary: "Processing failed",
      ticketId: null,
      error: message,
    }).catch((logError) => {
      console.error("Failed to record Respond.io failure", logError)
    })

    return NextResponse.json({ error: "Unable to process event." }, { status: 500 })
  }
}

async function dispatch(
  event: Parameters<typeof handleContactTagUpdated>[0],
  routingTag: string
): Promise<EventOutcome> {
  switch (event.eventType) {
    case "contact_tag_updated":
      return handleContactTagUpdated(event, routingTag)
    case "contact_assignee_updated":
      return handleAssigneeUpdated(event)
    case "message_sent":
      return handleMessageSent(event)
    case "conversation_closed":
      return handleConversationClosed(event)
  }
}

async function recordRejected(
  parsed: ReturnType<typeof parseRespondioEventPayload>,
  payload: unknown,
  rawBody: string
): Promise<void> {
  // Keyed on the rejected body, and prefixed so a rejection can never occupy the key
  // a later authenticated delivery of the same event would use. Repeated probing with
  // an identical body logs once rather than growing the ledger without bound; a
  // different body is a different row.
  const idempotencyKey = buildIdempotencyKey({
    eventId: `rejected:${rawBody.slice(0, 500)}`,
    eventType: "contact_tag_updated",
    respondioContactId: "",
    occurredAt: "",
    conversationId: null,
  })

  await claimWebhookEvent({
    eventType: parsed.ok ? parsed.value.eventType : "unknown",
    respondioContactId: parsed.ok ? parsed.value.respondioContactId : null,
    idempotencyKey,
    payloadRaw: payload,
    secretValid: false,
    initialStatus: "rejected",
    errorMessage: "secret_valid = false",
  }).catch((error) => {
    console.error("Failed to log rejected Respond.io event", error)
    return null
  })
}
