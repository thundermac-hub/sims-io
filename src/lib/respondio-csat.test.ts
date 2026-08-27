import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCsatMessage,
  dispatchCsatLink,
  isCsatAutoSendConfigured,
  resolveCsatAutoSendDecision,
} from "./respondio-csat.ts"
import type { CsatAutoSendInputs } from "./respondio-csat.ts"

const inputs = (overrides: Partial<CsatAutoSendInputs> = {}): CsatAutoSendInputs => ({
  respondioContactId: "rio_90118",
  alreadyShared: false,
  configured: true,
  ...overrides,
})

test("sends when the ticket has a Respond.io contact and nothing was shared yet", () => {
  assert.deepEqual(resolveCsatAutoSendDecision(inputs()), { send: true })
})

test("skips a ticket with no Respond.io contact", () => {
  assert.deepEqual(resolveCsatAutoSendDecision(inputs({ respondioContactId: null })), {
    send: false,
    reason: "no_respondio_contact",
  })
})

test("treats a blank Respond.io contact id as absent", () => {
  assert.deepEqual(resolveCsatAutoSendDecision(inputs({ respondioContactId: "   " })), {
    send: false,
    reason: "no_respondio_contact",
  })
})

test("skips when an agent already shared the link manually", () => {
  assert.deepEqual(resolveCsatAutoSendDecision(inputs({ alreadyShared: true })), {
    send: false,
    reason: "already_shared",
  })
})

test("skips silently when no webhook is configured", () => {
  assert.deepEqual(resolveCsatAutoSendDecision(inputs({ configured: false })), {
    send: false,
    reason: "not_configured",
  })
})

/**
 * The configuration guard is checked before the contact guard: an unconfigured
 * environment must report `not_configured` rather than blaming the ticket's data, so
 * local dev never looks like a broken integration.
 */
test("reports not_configured ahead of other skip reasons", () => {
  assert.deepEqual(
    resolveCsatAutoSendDecision(
      inputs({ configured: false, respondioContactId: null, alreadyShared: true })
    ),
    { send: false, reason: "not_configured" }
  )
})

test("message matches the manual share wording and ends with the link", () => {
  const message = buildCsatMessage("https://sims.example.com/csat/abc-123")
  assert.equal(
    message,
    "Hi! Thanks for contacting Merchant Success. We would love to hear your feedback. " +
      "Please take a moment to share your experience with us. " +
      "https://sims.example.com/csat/abc-123"
  )
})

test("configuration follows RESPONDIO_CSAT_WEBHOOK_URL", () => {
  const original = process.env.RESPONDIO_CSAT_WEBHOOK_URL
  try {
    delete process.env.RESPONDIO_CSAT_WEBHOOK_URL
    assert.equal(isCsatAutoSendConfigured(), false)

    process.env.RESPONDIO_CSAT_WEBHOOK_URL = "   "
    assert.equal(isCsatAutoSendConfigured(), false)

    process.env.RESPONDIO_CSAT_WEBHOOK_URL = "https://n8n.example.com/webhook/csat"
    assert.equal(isCsatAutoSendConfigured(), true)
  } finally {
    if (original === undefined) {
      delete process.env.RESPONDIO_CSAT_WEBHOOK_URL
    } else {
      process.env.RESPONDIO_CSAT_WEBHOOK_URL = original
    }
  }
})

const dispatchParams = {
  ticketId: "4821",
  respondioContactId: "rio_90118",
  phone: "+60162207781",
  merchantName: "Teh Tarik House",
  csatUrl: "https://sims.example.com/csat/abc-123",
  expiresAt: "2026-08-30 10:00:00.000",
}

test("dispatch skips instead of calling out when unconfigured", async () => {
  const original = process.env.RESPONDIO_CSAT_WEBHOOK_URL
  delete process.env.RESPONDIO_CSAT_WEBHOOK_URL
  try {
    assert.deepEqual(await dispatchCsatLink(dispatchParams), {
      status: "skipped",
      reason: "not_configured",
    })
  } finally {
    if (original !== undefined) {
      process.env.RESPONDIO_CSAT_WEBHOOK_URL = original
    }
  }
})

test("dispatch posts the message with the shared secret header", async () => {
  const originalUrl = process.env.RESPONDIO_CSAT_WEBHOOK_URL
  const originalSecret = process.env.RESPONDIO_CSAT_WEBHOOK_SECRET
  const originalFetch = globalThis.fetch
  process.env.RESPONDIO_CSAT_WEBHOOK_URL = "https://n8n.example.com/webhook/csat"
  process.env.RESPONDIO_CSAT_WEBHOOK_SECRET = "s3cret"

  let seen: { url: string; headers: Record<string, string>; body: string } | null = null
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = {
      url: String(url),
      headers: init.headers as Record<string, string>,
      body: String(init.body),
    }
    return new Response("{}", { status: 200 })
  }) as typeof globalThis.fetch

  try {
    const result = await dispatchCsatLink(dispatchParams)
    assert.deepEqual(result, { status: "sent" })
    assert.ok(seen)
    const sent = seen as unknown as { url: string; headers: Record<string, string>; body: string }
    assert.equal(sent.url, "https://n8n.example.com/webhook/csat")
    assert.equal(sent.headers["x-sims-webhook-secret"], "s3cret")

    const payload = JSON.parse(sent.body) as Record<string, unknown>
    assert.equal(payload.event, "csat_link_send")
    assert.equal(payload.ticketId, "4821")
    assert.equal(payload.respondioContactId, "rio_90118")
    assert.equal(payload.csatUrl, dispatchParams.csatUrl)
    assert.equal(payload.message, buildCsatMessage(dispatchParams.csatUrl))
    // Keyed on ticket + token so a redelivery of the same link is recognisable.
    assert.equal(payload.idempotencyKey, `csat:4821:${dispatchParams.csatUrl}`)
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) {
      delete process.env.RESPONDIO_CSAT_WEBHOOK_URL
    } else {
      process.env.RESPONDIO_CSAT_WEBHOOK_URL = originalUrl
    }
    if (originalSecret === undefined) {
      delete process.env.RESPONDIO_CSAT_WEBHOOK_SECRET
    } else {
      process.env.RESPONDIO_CSAT_WEBHOOK_SECRET = originalSecret
    }
  }
})

test("dispatch reports a non-2xx response as failed rather than throwing", async () => {
  const originalUrl = process.env.RESPONDIO_CSAT_WEBHOOK_URL
  const originalFetch = globalThis.fetch
  process.env.RESPONDIO_CSAT_WEBHOOK_URL = "https://n8n.example.com/webhook/csat"
  globalThis.fetch = (async () =>
    new Response("workflow inactive", { status: 404 })) as typeof globalThis.fetch

  try {
    const result = await dispatchCsatLink(dispatchParams)
    assert.equal(result.status, "failed")
    assert.match(
      result.status === "failed" ? result.error : "",
      /n8n responded 404: workflow inactive/
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) {
      delete process.env.RESPONDIO_CSAT_WEBHOOK_URL
    } else {
      process.env.RESPONDIO_CSAT_WEBHOOK_URL = originalUrl
    }
  }
})

test("dispatch reports a network error as failed rather than throwing", async () => {
  const originalUrl = process.env.RESPONDIO_CSAT_WEBHOOK_URL
  const originalFetch = globalThis.fetch
  process.env.RESPONDIO_CSAT_WEBHOOK_URL = "https://n8n.example.com/webhook/csat"
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED")
  }) as typeof globalThis.fetch

  try {
    const result = await dispatchCsatLink(dispatchParams)
    assert.deepEqual(result, { status: "failed", error: "ECONNREFUSED" })
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) {
      delete process.env.RESPONDIO_CSAT_WEBHOOK_URL
    } else {
      process.env.RESPONDIO_CSAT_WEBHOOK_URL = originalUrl
    }
  }
})
