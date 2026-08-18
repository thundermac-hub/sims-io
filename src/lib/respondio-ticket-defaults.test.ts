import assert from "node:assert/strict"
import test from "node:test"

import type {
  OutletMatchDecision,
  RespondioEvent,
} from "./respondio-resolution.ts"
import {
  RESPONDIO_ISSUE_TYPE,
  buildRespondioTicketInsert,
} from "./respondio-ticket-defaults.ts"
import type { RespondioTicketContext } from "./respondio-ticket-defaults.ts"

/**
 * `tickets.merchant_name`, `phone_number`, `issue_type` and `issue_description` are
 * NOT NULL with no defaults. These are the columns the insert must never leave empty.
 */
const NOT_NULL_COLUMNS = [
  "merchant_name",
  "phone_number",
  "issue_type",
  "issue_description",
  "status",
  "source",
  "respondio_contact_id",
] as const

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

const autoLink: OutletMatchDecision = {
  action: "auto_link",
  fid: "10688",
  oid: "23901",
  needsOutletMatch: false,
}

const franchisePrefill: OutletMatchDecision = {
  action: "franchise_prefill",
  fid: "11007",
  oid: null,
  needsOutletMatch: true,
}

const flagged: OutletMatchDecision = {
  action: "flag",
  fid: null,
  oid: null,
  needsOutletMatch: true,
}

const context = (
  overrides: Partial<RespondioTicketContext> = {}
): RespondioTicketContext => ({
  contactId: "3",
  contactName: "Tan Wei Ling",
  franchiseName: "Teh Tarik House",
  outletName: "Teh Tarik House, Mid Valley",
  ...overrides,
})

function assertNoNotNullHoles(row: Record<string, unknown>) {
  for (const column of NOT_NULL_COLUMNS) {
    const value = row[column]
    assert.notEqual(value, null, `${column} must not be null`)
    assert.notEqual(value, undefined, `${column} must not be undefined`)
    assert.notEqual(value, "", `${column} must not be an empty string`)
  }
}

test("an auto-linked ticket carries the franchise and outlet", () => {
  const row = buildRespondioTicketInsert(event(), autoLink, context())

  assert.equal(row.fid, "10688")
  assert.equal(row.oid, "23901")
  assert.equal(row.needs_outlet_match, 0)
  assert.equal(row.outlet_name_resolved, "Teh Tarik House, Mid Valley")
  assert.equal(row.franchise_name_resolved, "Teh Tarik House")
  assertNoNotNullHoles(row)
})

test("a franchise-prefilled ticket leaves the outlet unset and unnamed", () => {
  // Deliberately NOT the supportform's `outletName ?? merchantName` fallback: a
  // franchise name in an outlet field makes a flagged ticket look already linked.
  const row = buildRespondioTicketInsert(event(), franchisePrefill, context())

  assert.equal(row.fid, "11007")
  assert.equal(row.oid, null)
  assert.equal(row.outlet_name_resolved, null)
  assert.equal(row.franchise_name_resolved, "Teh Tarik House")
  assert.equal(row.needs_outlet_match, 1)
  assertNoNotNullHoles(row)
})

test("a fully flagged ticket has no franchise or outlet at all", () => {
  const row = buildRespondioTicketInsert(
    event(),
    flagged,
    context({ franchiseName: null, outletName: null })
  )

  assert.equal(row.fid, null)
  assert.equal(row.oid, null)
  assert.equal(row.needs_outlet_match, 1)
  assertNoNotNullHoles(row)
})

test("issue_type is the seeded placeholder category", () => {
  const row = buildRespondioTicketInsert(event(), flagged, context())

  assert.equal(row.issue_type, RESPONDIO_ISSUE_TYPE)
  assert.equal(row.issue_type, "Unclassified")
  assert.equal(row.issue_subcategory1, null)
  assert.equal(row.issue_subcategory2, null)
})

test("issue_description records the contact and when the event fired", () => {
  const row = buildRespondioTicketInsert(event(), flagged, context())

  assert.match(row.issue_description, /rio_90118/)
  assert.match(row.issue_description, /2026-08-17T09:14:00\.000Z/)
})

test("the ticket opens in the module's open state and is attributed to the system", () => {
  const row = buildRespondioTicketInsert(event(), flagged, context())

  assert.equal(row.status, "Open")
  assert.equal(row.source, "respond_io")
  assert.equal(row.updated_by, "system:respond_io")
})

test("merchant_name degrades through name, franchise, then phone", () => {
  const withContactName = buildRespondioTicketInsert(event(), flagged, context())
  assert.equal(withContactName.merchant_name, "Tan Wei Ling")

  const withEventName = buildRespondioTicketInsert(
    event(),
    flagged,
    context({ contactName: null })
  )
  assert.equal(withEventName.merchant_name, "Tan Wei Ling")

  const withFranchise = buildRespondioTicketInsert(
    event({ contactName: null }),
    flagged,
    context({ contactName: null })
  )
  assert.equal(withFranchise.merchant_name, "Teh Tarik House")

  const withPhoneOnly = buildRespondioTicketInsert(
    event({ contactName: "   " }),
    flagged,
    context({ contactName: null, franchiseName: null })
  )
  assert.equal(withPhoneOnly.merchant_name, "+60 16-220 7781")
  assertNoNotNullHoles(withPhoneOnly)
})

test("an absent email is stored as null, not an empty string", () => {
  const row = buildRespondioTicketInsert(
    event({ contactEmail: "  " }),
    flagged,
    context()
  )

  assert.equal(row.email, null)
})

test("an unresolved contact still produces a valid ticket", () => {
  const row = buildRespondioTicketInsert(
    event(),
    flagged,
    context({ contactId: null })
  )

  assert.equal(row.contact_id, null)
  assertNoNotNullHoles(row)
})

test("throws when the event carries no phone number", () => {
  // Phone is the key contact resolution joins on. Fabricating one would create an
  // unmatchable contact and an untraceable ticket, so the caller logs the event as
  // failed instead.
  assert.throws(
    () => buildRespondioTicketInsert(event({ contactPhone: null }), flagged, context()),
    /no phone number/
  )
  assert.throws(
    () => buildRespondioTicketInsert(event({ contactPhone: "  " }), flagged, context()),
    /no phone number/
  )
})
