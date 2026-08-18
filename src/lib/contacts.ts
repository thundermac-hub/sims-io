/**
 * Contacts: a standalone merchant-side person, mapped to specific outlets and/or
 * whole franchises.
 *
 * Validation and query building live here so the API routes stay thin and the rules
 * that matter -- what counts as a valid contact, what counts as a duplicate -- are
 * expressed once and unit-tested without a database. The mapping overlap rules are
 * in `src/lib/contact-mappings.ts`; the Respond.io resolution order is in
 * `src/lib/respondio-resolution.ts`.
 */

import type { RowDataPacket } from "mysql2/promise"

import { normalizePhone } from "./phone.ts"

/**
 * The subset of mysql2's `Pool` / `PoolConnection` these helpers need.
 *
 * Typed structurally rather than as `Pool` so the same function can run on a pooled
 * connection inside an open transaction — which the duplicate check must, or two
 * concurrent submissions each pass in isolation.
 */
type Queryable = {
  query<T extends RowDataPacket[]>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, unknown]>
}

export type ContactSource = "staff" | "respond_io"

export type ContactPhone = {
  id: string
  phone: string
  isPrimary: boolean
}

export type Contact = {
  id: string
  name: string
  email: string
  role: string | null
  source: ContactSource
  respondioContactId: string | null
  phones: ContactPhone[]
  mappingCount: number
  createdAt: string
  updatedAt: string
}

export type ContactInput = {
  name: string
  email: string
  role: string | null
  /** Raw, as typed. The first entry becomes the primary number. */
  phones: string[]
}

export type ContactValidation = {
  errors: Record<string, string>
  /** Present only when `errors` is empty. */
  value: NormalizedContactInput | null
}

export type NormalizedContactInput = {
  name: string
  email: string
  role: string | null
  phones: { phone: string; phoneNormalized: string; isPrimary: boolean }[]
}

export type DuplicateContactMatch = {
  contactId: string
  name: string
  role: string | null
  /** Which field collided. A submission can collide on both, against different contacts. */
  matchedOn: "email" | "phone"
  matchedValue: string
}

export type ContactRow = RowDataPacket & {
  id: number | string
  name: string
  email: string
  role: string | null
  source: ContactSource
  respondio_contact_id: string | null
  mapping_count: number | string | null
  created_at: string
  updated_at: string
}

export type ContactPhoneRow = RowDataPacket & {
  id: number | string
  contact_id: number | string
  phone: string
  is_primary: number
}

// Mirrors the repo's existing inline pattern (see user-management/page.tsx). Kept
// deliberately loose: these are merchant-supplied addresses, not credentials, and a
// stricter regex rejects valid real-world addresses more often than it catches typos.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX_NAME_LENGTH = 255
const MAX_EMAIL_LENGTH = 255
const MAX_ROLE_LENGTH = 255
const MAX_PHONE_LENGTH = 32

export const contactSelectSql = `
  SELECT
    contacts.id,
    contacts.name,
    contacts.email,
    contacts.role,
    contacts.source,
    contacts.respondio_contact_id,
    contacts.created_at,
    contacts.updated_at,
    (
      SELECT COUNT(*)
      FROM contact_outlets
      WHERE contact_outlets.contact_id = contacts.id
    ) AS mapping_count
  FROM contacts
`

export function mapContact(row: ContactRow, phones: ContactPhone[]): Contact {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    source: row.source,
    respondioContactId: row.respondio_contact_id,
    phones,
    mappingCount: toCount(row.mapping_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapContactPhone(row: ContactPhoneRow): ContactPhone {
  return {
    id: String(row.id),
    phone: row.phone,
    isPrimary: row.is_primary === 1,
  }
}

function toCount(value: number | string | null): number {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * Validate and normalize a create/edit submission.
 *
 * Phone numbers are de-duplicated within the submission itself before they reach the
 * database, because `contact_phone_numbers` has a UNIQUE key on
 * (contact_id, phone_normalized) and the same number typed twice in two different
 * formats would otherwise fail the insert rather than the validator.
 */
export function validateContactInput(input: ContactInput): ContactValidation {
  const errors: Record<string, string> = {}

  const name = input.name?.trim() ?? ""
  if (!name) {
    errors.name = "Name is required."
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`
  }

  const email = input.email?.trim().toLowerCase() ?? ""
  if (!email) {
    errors.email = "Email is required."
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address."
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.email = `Email must be ${MAX_EMAIL_LENGTH} characters or fewer.`
  }

  const role = input.role?.trim() || null
  if (role && role.length > MAX_ROLE_LENGTH) {
    errors.role = `Role must be ${MAX_ROLE_LENGTH} characters or fewer.`
  }

  const rawPhones = (input.phones ?? []).map((phone) => phone?.trim() ?? "")
  const provided = rawPhones.filter(Boolean)

  if (!provided.length) {
    errors.phones = "At least one phone number is required."
  }

  const phones: NormalizedContactInput["phones"] = []
  const seen = new Set<string>()

  for (const [index, phone] of provided.entries()) {
    const phoneNormalized = normalizePhone(phone)

    if (!phoneNormalized) {
      errors[`phones.${index}`] = "Enter a valid phone number."
      continue
    }
    if (phone.length > MAX_PHONE_LENGTH) {
      errors[`phones.${index}`] = `Phone must be ${MAX_PHONE_LENGTH} characters or fewer.`
      continue
    }
    if (seen.has(phoneNormalized)) {
      errors[`phones.${index}`] = "This number is already listed on this contact."
      continue
    }

    seen.add(phoneNormalized)
    phones.push({ phone, phoneNormalized, isPrimary: phones.length === 0 })
  }

  if (Object.keys(errors).length) {
    return { errors, value: null }
  }

  return { errors, value: { name, email, role, phones } }
}

/**
 * LIKE clause matching a contact by name, email, or any of its phone numbers.
 *
 * Modelled on `buildMerchantSearchClause` in `src/lib/merchant-lookup.ts`. The phone
 * arm searches `phone_normalized` with the query normalized the same way, so
 * searching "016 220" finds "+60 16-220 7781".
 */
export function buildContactSearchClause(query: string): {
  sql: string
  values: string[]
} {
  const trimmed = query.trim().toLowerCase()
  const like = `%${trimmed}%`
  const normalizedLike = `%${normalizePhone(trimmed).replace(/^\+/, "")}%`

  return {
    sql: `(
      LOWER(contacts.name) LIKE ?
      OR LOWER(contacts.email) LIKE ?
      OR LOWER(COALESCE(contacts.role, '')) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM contact_phone_numbers
        WHERE contact_phone_numbers.contact_id = contacts.id
          AND (
            REPLACE(contact_phone_numbers.phone_normalized, '+', '') LIKE ?
            OR LOWER(contact_phone_numbers.phone) LIKE ?
          )
      )
    )`,
    values: [like, like, like, normalizedLike, like],
  }
}

/**
 * Clause restricting contacts to those mapped to a given franchise and/or outlet.
 *
 * When an outlet is supplied the match is deliberately wider than equality: a
 * contact mapped franchise-wide (`outlet_id IS NULL`) represents every outlet under
 * that franchise and must appear for any of them.
 */
export function buildContactScopeClause(
  franchiseId: string | null,
  outletId: string | null
): { sql: string; values: string[] } | null {
  const fid = franchiseId?.trim() ?? ""
  const oid = outletId?.trim() ?? ""

  if (!fid && !oid) {
    return null
  }

  if (fid && oid) {
    return {
      sql: `EXISTS (
        SELECT 1 FROM contact_outlets
        WHERE contact_outlets.contact_id = contacts.id
          AND contact_outlets.franchise_id = ?
          AND (contact_outlets.outlet_id = ? OR contact_outlets.outlet_id IS NULL)
      )`,
      values: [fid, oid],
    }
  }

  if (fid) {
    return {
      sql: `EXISTS (
        SELECT 1 FROM contact_outlets
        WHERE contact_outlets.contact_id = contacts.id
          AND contact_outlets.franchise_id = ?
      )`,
      values: [fid],
    }
  }

  return {
    sql: `EXISTS (
      SELECT 1 FROM contact_outlets
      WHERE contact_outlets.contact_id = contacts.id
        AND contact_outlets.outlet_id = ?
    )`,
    values: [oid],
  }
}

/**
 * Find existing non-deleted contacts colliding on the submitted email or any
 * submitted phone number.
 *
 * Both axes are queried and *all* matches returned, because a single submission can
 * collide on the phone against one contact and on the email against a different one
 * -- the UI surfaces both so staff can choose which to use.
 *
 * Callers must run this inside the same transaction as the insert. Checking outside
 * it lets two near-simultaneous submissions of the same phone both pass.
 */
export async function findDuplicateContacts(
  db: Queryable,
  params: {
    email: string
    phonesNormalized: string[]
    excludeContactId?: string | null
  }
): Promise<DuplicateContactMatch[]> {
  const matches: DuplicateContactMatch[] = []
  const exclude = params.excludeContactId ?? null

  type MatchRow = RowDataPacket & {
    id: number | string
    name: string
    role: string | null
    matched_value: string
  }

  if (params.email) {
    const [rows] = await db.query<MatchRow[]>(
      `
      SELECT id, name, role, email AS matched_value
      FROM contacts
      WHERE deleted_at IS NULL
        AND LOWER(email) = ?
        AND (? IS NULL OR id <> ?)
      LIMIT 5
    `,
      [params.email.trim().toLowerCase(), exclude, exclude]
    )

    for (const row of rows) {
      matches.push({
        contactId: String(row.id),
        name: row.name,
        role: row.role,
        matchedOn: "email",
        matchedValue: row.matched_value,
      })
    }
  }

  const phones = params.phonesNormalized.filter(Boolean)
  if (phones.length) {
    const placeholders = phones.map(() => "?").join(", ")
    const [rows] = await db.query<MatchRow[]>(
      `
      SELECT
        contacts.id,
        contacts.name,
        contacts.role,
        contact_phone_numbers.phone AS matched_value
      FROM contact_phone_numbers
      INNER JOIN contacts ON contacts.id = contact_phone_numbers.contact_id
      WHERE contacts.deleted_at IS NULL
        AND contact_phone_numbers.phone_normalized IN (${placeholders})
        AND (? IS NULL OR contacts.id <> ?)
      LIMIT 5
    `,
      [...phones, exclude, exclude]
    )

    for (const row of rows) {
      matches.push({
        contactId: String(row.id),
        name: row.name,
        role: row.role,
        matchedOn: "phone",
        matchedValue: row.matched_value,
      })
    }
  }

  return matches
}

/** Directory phone cell: "+1 more" when a contact has secondary numbers. */
export function formatExtraPhones(phones: ContactPhone[]): string {
  const extra = Math.max(0, phones.length - 1)
  return extra ? `+${extra} more` : ""
}

export function formatContactSource(source: ContactSource): string {
  return source === "respond_io" ? "Created from Respond.io" : "Added by staff"
}
