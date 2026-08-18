/**
 * Pure decision functions for the Respond.io -> SIMS ticket automation.
 *
 * Everything here takes already-fetched rows and returns a decision, so the rules
 * that matter (which contact an inbound event resolves to, whether a ticket can be
 * auto-linked to an outlet, whether a redelivery is a duplicate) are unit-testable
 * without a database. The DB-touching orchestration lives in `src/lib/respondio.ts`.
 */

import { createHash } from "node:crypto"

import type { ContactMapping } from "./contact-mappings.ts"
import { normalizePhone, phonesMatch } from "./phone.ts"

export type RespondioEventType =
  | "contact_tag_updated"
  | "contact_assignee_updated"
  | "conversation_closed"

export type RespondioEvent = {
  eventId: string | null
  eventType: RespondioEventType
  occurredAt: string
  respondioContactId: string
  conversationId: string | null
  tag: string | null
  assigneeEmail: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
}

export type ContactMatchCandidate = {
  id: string
  email: string | null
  respondioContactId: string | null
  phonesNormalized: string[]
  deletedAt: string | null
}

export type ContactMatch = {
  contactId: string
  matchedBy: "respondio_id" | "phone" | "email"
  /**
   * True when the matched contact is soft-deleted. The caller must not auto-link or
   * pre-fill against it -- the ticket is flagged for manual review instead (PRD R14).
   */
  softDeleted: boolean
}

export type OutletMatchDecision = {
  action: "auto_link" | "franchise_prefill" | "flag"
  fid: string | null
  oid: string | null
  needsOutletMatch: boolean
}

// Re-exported so callers that already reach for these through this module keep working.
export { normalizePhone, phonesMatch }

export type ParsedEvent =
  | { ok: true; value: RespondioEvent }
  | { ok: false; error: string }

/**
 * Field aliases the `@respond-io/n8n-nodes-respond-io` node may emit.
 *
 * n8n's own trigger names differ from the shapes its HTTP body uses, and the node has
 * changed field casing between releases, so each value is read through a list of
 * candidates rather than one hard-coded key. Confirm the real names against a live
 * n8n execution before trimming this list.
 */
const EVENT_TYPE_ALIASES: Record<string, RespondioEventType> = {
  "contact.tag_added": "contact_tag_updated",
  "contact.tag.updated": "contact_tag_updated",
  contact_tag_updated: "contact_tag_updated",
  "contact tag updated": "contact_tag_updated",
  "contact.assignee.updated": "contact_assignee_updated",
  contact_assignee_updated: "contact_assignee_updated",
  "contact assignee updated": "contact_assignee_updated",
  "conversation.closed": "conversation_closed",
  conversation_closed: "conversation_closed",
  "conversation closed": "conversation_closed",
}

/**
 * Validate and narrow an inbound webhook body.
 *
 * Returns a result rather than throwing so the endpoint can record the event as
 * `failed` with the reason and still answer n8n, instead of surfacing a 500 that n8n
 * will retry forever against a payload shape that will never parse.
 */
export function parseRespondioEventPayload(input: unknown): ParsedEvent {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Body must be a JSON object." }
  }

  const body = input as Record<string, unknown>
  const contact = readRecord(body, ["contact", "data", "payload"]) ?? body

  const rawEventType = readString(body, ["event_type", "eventType", "event", "type"])
  if (!rawEventType) {
    return { ok: false, error: "Missing event type." }
  }

  const eventType = EVENT_TYPE_ALIASES[rawEventType.trim().toLowerCase()]
  if (!eventType) {
    return { ok: false, error: `Unsupported event type "${rawEventType}".` }
  }

  const respondioContactId = readString(contact, [
    "respondio_contact_id",
    "respondioContactId",
    "contact_id",
    "contactId",
    "id",
  ])
  if (!respondioContactId) {
    return { ok: false, error: "Missing Respond.io contact id." }
  }

  const conversation = readRecord(body, ["conversation"])

  return {
    ok: true,
    value: {
      eventId: readString(body, ["event_id", "eventId", "execution_id"]),
      eventType,
      occurredAt:
        readString(body, ["occurred_at", "occurredAt", "timestamp", "created_at"]) ??
        "",
      respondioContactId,
      conversationId: readString(conversation ?? body, [
        "conversation_id",
        "conversationId",
        "id",
      ]),
      tag: readString(body, ["tag", "tag_name", "tagName"]),
      assigneeEmail: readString(
        readRecord(body, ["assignee", "user"]) ?? body,
        ["assignee_email", "assigneeEmail", "email"]
      ),
      contactName: buildContactName(contact),
      contactEmail: readString(contact, ["email", "contact_email"]),
      contactPhone: readString(contact, ["phone", "phone_number", "phoneNumber"]),
    },
  }
}

function buildContactName(contact: Record<string, unknown>): string | null {
  const full = readString(contact, ["name", "full_name", "fullName"])
  if (full) {
    return full
  }

  const first = readString(contact, ["first_name", "firstName"])
  const last = readString(contact, ["last_name", "lastName"])
  const joined = [first, last].filter(Boolean).join(" ").trim()

  return joined || null
}

function readString(
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return null
}

function readRecord(
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return null
}

/**
 * Resolve an inbound Respond.io contact to a SIMS contact, in the order the PRD
 * mandates: stored `respondio_contact_id`, then any phone number, then email.
 *
 * Takes the already-fetched candidate rows so it stays DB-free. Returns `null` when
 * nothing matches, which tells the caller to auto-create a contact.
 *
 * Soft-deleted candidates still match -- they must, or a deleted contact would be
 * silently duplicated on the next inbound event. The `softDeleted` flag on the
 * result is what stops the caller auto-linking against a hidden record.
 */
export function resolveContactCandidate(
  event: Pick<RespondioEvent, "respondioContactId" | "contactEmail" | "contactPhone">,
  candidates: ContactMatchCandidate[]
): ContactMatch | null {
  const byRespondioId = candidates.find(
    (candidate) =>
      candidate.respondioContactId !== null &&
      candidate.respondioContactId === event.respondioContactId
  )
  if (byRespondioId) {
    return toMatch(byRespondioId, "respondio_id")
  }

  const inboundPhone = normalizePhone(event.contactPhone)
  if (inboundPhone) {
    const byPhone = candidates.find((candidate) =>
      candidate.phonesNormalized.some((phone) => phonesMatch(phone, inboundPhone))
    )
    if (byPhone) {
      return toMatch(byPhone, "phone")
    }
  }

  const inboundEmail = event.contactEmail?.trim().toLowerCase()
  if (inboundEmail) {
    const byEmail = candidates.find(
      (candidate) => candidate.email?.trim().toLowerCase() === inboundEmail
    )
    if (byEmail) {
      return toMatch(byEmail, "email")
    }
  }

  return null
}

function toMatch(
  candidate: ContactMatchCandidate,
  matchedBy: ContactMatch["matchedBy"]
): ContactMatch {
  return {
    contactId: candidate.id,
    matchedBy,
    softDeleted: candidate.deletedAt !== null,
  }
}

/**
 * Decide how a ticket links to an outlet, given the resolved contact's mappings.
 *
 * The four cases are exactly PRD 4.4:
 *
 *  - zero mappings -> flag, no pre-fill
 *  - exactly one outlet-specific mapping -> auto-link outright
 *  - franchise-wide only, one franchise -> pre-fill `fid`, still flag so the agent
 *    picks the outlet (scoped to that franchise)
 *  - anything else (several outlet-specific rows, or rows spanning more than one
 *    franchise) -> flag, no pre-fill, because the right outlet cannot be inferred
 *
 * The middle two cases both hinge on "all rows under one franchise": several
 * outlet-specific rows under a single franchise still cannot be auto-linked, but the
 * franchise is unambiguous, so it is worth pre-filling.
 */
export function resolveOutletMatch(
  mappings: ContactMapping[]
): OutletMatchDecision {
  if (!mappings.length) {
    return { action: "flag", fid: null, oid: null, needsOutletMatch: true }
  }

  const franchises = new Set(mappings.map((mapping) => mapping.franchiseId))
  if (franchises.size > 1) {
    return { action: "flag", fid: null, oid: null, needsOutletMatch: true }
  }

  const franchiseId = mappings[0].franchiseId
  const specific = mappings.filter((mapping) => mapping.outletId !== null)

  if (specific.length === 1) {
    return {
      action: "auto_link",
      fid: franchiseId,
      oid: specific[0].outletId,
      needsOutletMatch: false,
    }
  }

  // Either franchise-wide only, or several outlet-specific rows under one
  // franchise. Both leave the outlet ambiguous but the franchise certain.
  return {
    action: "franchise_prefill",
    fid: franchiseId,
    oid: null,
    needsOutletMatch: true,
  }
}

/**
 * Derive the idempotency key for an inbound event.
 *
 * n8n retries on failure and may redeliver the same event, so the key must be
 * stable across redeliveries and distinct between genuinely different events.
 * n8n's own event id is preferred when present; otherwise the key is a digest of
 * the event type, contact, timestamp and conversation, which is what PRD 4.8
 * specifies.
 */
export function buildIdempotencyKey(
  event: Pick<
    RespondioEvent,
    "eventId" | "eventType" | "respondioContactId" | "occurredAt" | "conversationId"
  >
): string {
  const material = event.eventId
    ? `event_id|${event.eventId}`
    : [
        event.eventType,
        event.respondioContactId,
        event.occurredAt,
        event.conversationId ?? "",
      ].join("|")

  return createHash("sha256").update(material).digest("hex")
}

/**
 * A resolved contact that has since been soft-deleted must not be auto-linked
 * against, nor silently revived. The ticket is created and flagged for manual
 * review instead (PRD R14 / AC11).
 */
export function shouldSkipSoftDeletedContact(
  match: ContactMatch | null
): boolean {
  return Boolean(match?.softDeleted)
}
