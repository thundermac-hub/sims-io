/**
 * Column values for a ticket auto-created from a Respond.io event.
 *
 * `tickets` predates this integration and has four NOT NULL columns with no defaults
 * -- `merchant_name`, `phone_number`, `issue_type`, `issue_description` -- that the
 * public support form always supplies but an inbound webhook does not. Neither PRD
 * specifies values for them, so the placeholders below are a deliberate choice; see
 * the accompanying test, which asserts no NOT NULL column is ever null or empty.
 *
 * `issue_type` is stored as free text with no FK to `ticket_categories` (the
 * supportform route inserts it unvalidated), so a sentinel is safe. Migration 025
 * seeds a matching `'Unclassified'` category row so the ticket-edit dropdown has an
 * option to show rather than rendering blank.
 */

import type {
  OutletMatchDecision,
  RespondioEvent,
} from "./respondio-resolution.ts"

/** The module's open state. `tickets.status` is an ENUM and 'Open' is its first value. */
export const RESPONDIO_TICKET_STATUS = "Open"
/** Set when an agent sends the first outgoing message on the conversation. */
export const RESPONDIO_IN_PROGRESS_STATUS = "In Progress"
/** The module's closed state, set when the Respond.io conversation closes. */
export const RESPONDIO_CLOSED_STATUS = "Resolved"
export const RESPONDIO_ISSUE_TYPE = "Unclassified"
/** Greppable sentinel, distinct from the user ids `updated_by` normally carries. */
export const RESPONDIO_ACTOR = "system:respond_io"

export type RespondioTicketInsert = {
  merchant_name: string
  phone_number: string
  email: string | null
  fid: string | null
  oid: string | null
  franchise_name_resolved: string | null
  outlet_name_resolved: string | null
  issue_type: string
  issue_subcategory1: null
  issue_subcategory2: null
  issue_description: string
  status: string
  source: "respond_io"
  respondio_contact_id: string
  contact_id: string | null
  needs_outlet_match: 0 | 1
  updated_by: string
}

export type RespondioTicketContext = {
  contactId: string | null
  contactName: string | null
  franchiseName: string | null
  outletName: string | null
}

/**
 * Build the exact column -> value map for the INSERT.
 *
 * Throws when the event has no usable phone number. That is not a defensive
 * afterthought: phone is the key the contact resolution joins on, so fabricating one
 * would create an unmatchable contact and a ticket nobody can trace back. The caller
 * records the event as `failed` instead.
 */
export function buildRespondioTicketInsert(
  event: RespondioEvent,
  mapping: OutletMatchDecision,
  context: RespondioTicketContext
): RespondioTicketInsert {
  const phone = event.contactPhone?.trim() ?? ""
  if (!phone) {
    throw new Error(
      "Respond.io event has no phone number; cannot create a ticket without one."
    )
  }

  return {
    merchant_name: resolveMerchantName(event, context, phone),
    phone_number: phone,
    email: event.contactEmail?.trim() || null,
    fid: mapping.fid,
    oid: mapping.oid,
    franchise_name_resolved: context.franchiseName,
    // Left null when the outlet is unknown. Deliberately NOT the supportform's
    // `outletName ?? merchantName` fallback, which would put a franchise name in an
    // outlet field and make a flagged ticket look already linked.
    outlet_name_resolved: mapping.oid ? context.outletName : null,
    issue_type: RESPONDIO_ISSUE_TYPE,
    issue_subcategory1: null,
    issue_subcategory2: null,
    issue_description: buildIssueDescription(event),
    status: RESPONDIO_TICKET_STATUS,
    source: "respond_io",
    respondio_contact_id: event.respondioContactId,
    contact_id: context.contactId,
    needs_outlet_match: mapping.needsOutletMatch ? 1 : 0,
    updated_by: RESPONDIO_ACTOR,
  }
}

/**
 * `merchant_name` is NOT NULL and is the column every ticket list renders, so it
 * degrades through progressively vaguer but always-present values rather than ever
 * being empty.
 */
function resolveMerchantName(
  event: RespondioEvent,
  context: RespondioTicketContext,
  phone: string
): string {
  const candidates = [
    context.contactName?.trim(),
    event.contactName?.trim(),
    context.franchiseName?.trim(),
    phone,
  ]

  for (const candidate of candidates) {
    if (candidate) {
      return candidate
    }
  }

  return "Unknown (Respond.io)"
}

function buildIssueDescription(event: RespondioEvent): string {
  return [
    `Auto-created from Respond.io conversation (contact ${event.respondioContactId})`,
    `at ${event.occurredAt}.`,
    "Awaiting agent triage.",
  ].join(" ")
}
