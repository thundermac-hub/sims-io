import assert from "node:assert/strict"
import test from "node:test"

import type { ContactMapping } from "./contact-mappings.ts"
import {
  buildIdempotencyKey,
  normalizePhone,
  phonesMatch,
  resolveContactCandidate,
  resolveOutletMatch,
  shouldSkipSoftDeletedContact,
} from "./respondio-resolution.ts"
import type {
  ContactMatchCandidate,
  RespondioEvent,
} from "./respondio-resolution.ts"

// ---------------------------------------------------------------------------
// normalizePhone / phonesMatch
// ---------------------------------------------------------------------------

test("normalizePhone strips formatting but keeps a leading plus", () => {
  assert.equal(normalizePhone("+60 16-220 7781"), "+60162207781")
  assert.equal(normalizePhone("016-220 7781"), "0162207781")
  assert.equal(normalizePhone("  +60 (3) 2145 8890 "), "+60321458890")
})

test("normalizePhone returns an empty string when there are no digits", () => {
  assert.equal(normalizePhone(""), "")
  assert.equal(normalizePhone(null), "")
  assert.equal(normalizePhone(undefined), "")
  assert.equal(normalizePhone("n/a"), "")
})

test("phonesMatch treats the international and national forms as one number", () => {
  assert.equal(phonesMatch("+60162207781", "0162207781"), true)
  assert.equal(phonesMatch("60162207781", "+60 16-220 7781"), true)
  assert.equal(phonesMatch("0162207781", "016 220 7781"), true)
})

test("phonesMatch rejects different subscribers and empty input", () => {
  assert.equal(phonesMatch("+60162207781", "+60198824410"), false)
  assert.equal(phonesMatch("", ""), false)
  assert.equal(phonesMatch("+60162207781", ""), false)
})

// ---------------------------------------------------------------------------
// resolveContactCandidate
// ---------------------------------------------------------------------------

const event = (overrides: Partial<RespondioEvent> = {}): RespondioEvent => ({
  eventId: null,
  eventType: "contact_tag_updated",
  occurredAt: "2026-08-17T09:14:00.000Z",
  respondioContactId: "rio_90118",
  conversationId: "conv_1",
  tag: "team:merchant_success",
  assigneeEmail: null,
  contactName: "Tan Wei Ling",
  contactEmail: "weiling@teh-tarik-house.com",
  contactPhone: "+60 16-220 7781",
  ...overrides,
})

const candidate = (
  overrides: Partial<ContactMatchCandidate> = {}
): ContactMatchCandidate => ({
  id: "1",
  email: "weiling@teh-tarik-house.com",
  respondioContactId: null,
  phonesNormalized: ["+60162207781"],
  deletedAt: null,
  ...overrides,
})

test("matches by respondio_contact_id ahead of phone and email", () => {
  const match = resolveContactCandidate(event(), [
    candidate({ id: "phone-and-email-match" }),
    candidate({
      id: "id-match",
      email: "someone.else@example.com",
      respondioContactId: "rio_90118",
      phonesNormalized: ["+60111111111"],
    }),
  ])

  assert.equal(match?.contactId, "id-match")
  assert.equal(match?.matchedBy, "respondio_id")
})

test("matches by phone when no stored respondio id exists", () => {
  const match = resolveContactCandidate(
    event({ contactEmail: "unknown@example.com" }),
    [candidate({ id: "phone-match" })]
  )

  assert.equal(match?.contactId, "phone-match")
  assert.equal(match?.matchedBy, "phone")
})

test("matches by phone across international and national formats", () => {
  const match = resolveContactCandidate(
    event({ contactPhone: "0162207781", contactEmail: null }),
    [candidate({ phonesNormalized: ["+60162207781"] })]
  )

  assert.equal(match?.matchedBy, "phone")
})

test("matches a secondary phone number, not just the primary", () => {
  const match = resolveContactCandidate(
    event({ contactPhone: "+60 3-2145 8890", contactEmail: null }),
    [candidate({ phonesNormalized: ["+60123456789", "+60321458890"] })]
  )

  assert.equal(match?.matchedBy, "phone")
})

test("falls back to a case-insensitive email match", () => {
  const match = resolveContactCandidate(
    event({ contactPhone: "+60 11-9999 0000", contactEmail: "WeiLing@Teh-Tarik-House.com" }),
    [candidate({ id: "email-match" })]
  )

  assert.equal(match?.contactId, "email-match")
  assert.equal(match?.matchedBy, "email")
})

test("returns null when nothing matches, so the caller auto-creates", () => {
  const match = resolveContactCandidate(
    event({ contactPhone: "+60 11-9999 0000", contactEmail: "nobody@example.com" }),
    [candidate()]
  )

  assert.equal(match, null)
})

test("still matches a soft-deleted contact but flags it", () => {
  // It must match: otherwise every inbound event would silently create a fresh
  // duplicate of a contact staff deliberately deleted. The flag is what stops the
  // caller auto-linking against the hidden record.
  const match = resolveContactCandidate(event(), [
    candidate({ respondioContactId: "rio_90118", deletedAt: "2026-08-10T00:00:00.000Z" }),
  ])

  assert.equal(match?.matchedBy, "respondio_id")
  assert.equal(match?.softDeleted, true)
  assert.equal(shouldSkipSoftDeletedContact(match), true)
})

test("shouldSkipSoftDeletedContact is false for a live match and for no match", () => {
  assert.equal(shouldSkipSoftDeletedContact(null), false)
  assert.equal(
    shouldSkipSoftDeletedContact({
      contactId: "1",
      matchedBy: "phone",
      softDeleted: false,
    }),
    false
  )
})

// ---------------------------------------------------------------------------
// resolveOutletMatch — the four PRD 4.4 branches
// ---------------------------------------------------------------------------

const outlet = (franchiseId: string, outletId: string): ContactMapping => ({
  id: `${franchiseId}-${outletId}`,
  franchiseId,
  outletId,
})

const franchiseWide = (franchiseId: string): ContactMapping => ({
  id: `${franchiseId}-wide`,
  franchiseId,
  outletId: null,
})

test("zero mappings flags the ticket with no pre-fill", () => {
  assert.deepEqual(resolveOutletMatch([]), {
    action: "flag",
    fid: null,
    oid: null,
    needsOutletMatch: true,
  })
})

test("exactly one outlet-specific mapping auto-links outright", () => {
  assert.deepEqual(resolveOutletMatch([outlet("10688", "23901")]), {
    action: "auto_link",
    fid: "10688",
    oid: "23901",
    needsOutletMatch: false,
  })
})

test("a lone franchise-wide mapping pre-fills the franchise and still flags", () => {
  assert.deepEqual(resolveOutletMatch([franchiseWide("11007")]), {
    action: "franchise_prefill",
    fid: "11007",
    oid: null,
    needsOutletMatch: true,
  })
})

test("several outlets under one franchise pre-fill the franchise only", () => {
  // The outlet is ambiguous, but the franchise is not — worth pre-filling so the
  // agent only has to supply the outlet id.
  assert.deepEqual(
    resolveOutletMatch([
      outlet("10233", "21004"),
      outlet("10233", "21008"),
      outlet("10233", "21011"),
    ]),
    { action: "franchise_prefill", fid: "10233", oid: null, needsOutletMatch: true }
  )
})

test("mappings spanning more than one franchise flag with no pre-fill", () => {
  assert.deepEqual(
    resolveOutletMatch([franchiseWide("10442"), outlet("10871", "22318")]),
    { action: "flag", fid: null, oid: null, needsOutletMatch: true }
  )
})

test("two outlet mappings in different franchises flag with no pre-fill", () => {
  assert.deepEqual(
    resolveOutletMatch([outlet("10233", "21004"), outlet("10688", "23901")]),
    { action: "flag", fid: null, oid: null, needsOutletMatch: true }
  )
})

// ---------------------------------------------------------------------------
// buildIdempotencyKey
// ---------------------------------------------------------------------------

test("the same event derives the same idempotency key", () => {
  assert.equal(buildIdempotencyKey(event()), buildIdempotencyKey(event()))
})

test("a different event type or timestamp derives a different key", () => {
  const base = buildIdempotencyKey(event())

  assert.notEqual(base, buildIdempotencyKey(event({ eventType: "conversation_closed" })))
  assert.notEqual(base, buildIdempotencyKey(event({ occurredAt: "2026-08-17T09:15:00.000Z" })))
  assert.notEqual(base, buildIdempotencyKey(event({ respondioContactId: "rio_91443" })))
})

test("n8n's own event id wins over the derived digest", () => {
  const withId = buildIdempotencyKey(event({ eventId: "n8n_exec_9001" }))

  // Same event id, everything else different — still the same key, because a
  // redelivery is a redelivery.
  assert.equal(
    withId,
    buildIdempotencyKey(
      event({
        eventId: "n8n_exec_9001",
        eventType: "conversation_closed",
        occurredAt: "2026-01-01T00:00:00.000Z",
      })
    )
  )
  assert.notEqual(withId, buildIdempotencyKey(event()))
})

test("the idempotency key is a sha256 hex digest", () => {
  assert.match(buildIdempotencyKey(event()), /^[0-9a-f]{64}$/)
})
