import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import {
  contactSelectSql,
  findDuplicateContacts,
  validateContactInput,
} from "@/lib/contacts"
import type { ContactRow } from "@/lib/contacts"
import {
  attachPhones,
  cleanString,
  loadContactMappings,
  parseContactId,
  resolveContactsUser,
  withContactLock,
} from "../helpers"

/** GET /api/contacts/[contactId] — the contact plus its resolved mappings. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const { contactId: rawId } = await params
  const contactId = parseContactId(rawId)
  if (contactId === null) {
    return NextResponse.json({ error: "Invalid contact id." }, { status: 400 })
  }

  const [rows] = await queryWithReconnect<ContactRow[]>(
    `${contactSelectSql} WHERE contacts.id = ? AND contacts.deleted_at IS NULL LIMIT 1`,
    [contactId]
  )

  if (!rows.length) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 })
  }

  const [contact] = await attachPhones(rows)
  const mappings = await loadContactMappings(contactId)

  return NextResponse.json({ contact, mappings })
}

/**
 * PATCH /api/contacts/[contactId] — edit name, email, role and phone numbers.
 *
 * Re-runs the same duplicate check as creation, excluding this record, and blocks the
 * edit on a match (PRD 4.3). Phone numbers are replaced wholesale rather than diffed:
 * the rows carry no meaning beyond their value and primary flag, so a delete-and-insert
 * inside the transaction is simpler than reconciling three-way changes, and the
 * contact's `id` — the thing everything else references — is untouched either way.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const { contactId: rawId } = await params
  const contactId = parseContactId(rawId)
  if (contactId === null) {
    return NextResponse.json({ error: "Invalid contact id." }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    email?: unknown
    role?: unknown
    phones?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const validation = validateContactInput({
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    role: cleanString(body.role),
    phones: Array.isArray(body.phones)
      ? body.phones.filter((entry): entry is string => typeof entry === "string")
      : [],
  })

  if (!validation.value) {
    return NextResponse.json(
      { error: "Please correct the highlighted fields.", errors: validation.errors },
      { status: 400 }
    )
  }

  const input = validation.value

  try {
    const outcome = await withContactLock(contactId, async (connection) => {
      const [existing] = await connection.query<ContactRow[]>(
        `SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [contactId]
      )
      if (!existing.length) {
        return { notFound: true as const }
      }

      const matches = await findDuplicateContacts(connection, {
        email: input.email,
        phonesNormalized: input.phones.map((phone) => phone.phoneNormalized),
        excludeContactId: String(contactId),
      })
      if (matches.length) {
        return { matches }
      }

      await connection.query(
        `UPDATE contacts SET name = ?, email = ?, role = ? WHERE id = ?`,
        [input.name, input.email, input.role, contactId]
      )

      await connection.query(
        `DELETE FROM contact_phone_numbers WHERE contact_id = ?`,
        [contactId]
      )
      await connection.query(
        `INSERT INTO contact_phone_numbers (contact_id, phone, phone_normalized, is_primary)
         VALUES ${input.phones.map(() => "(?, ?, ?, ?)").join(", ")}`,
        input.phones.flatMap((phone) => [
          contactId,
          phone.phone,
          phone.phoneNormalized,
          phone.isPrimary ? 1 : 0,
        ])
      )

      return { updated: true as const }
    })

    if ("notFound" in outcome) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 })
    }
    if ("matches" in outcome) {
      return NextResponse.json(
        {
          error:
            "Another contact already uses this phone number or email.",
          matches: outcome.matches,
        },
        { status: 409 }
      )
    }

    const [rows] = await queryWithReconnect<ContactRow[]>(
      `${contactSelectSql} WHERE contacts.id = ? LIMIT 1`,
      [contactId]
    )
    const [contact] = await attachPhones(rows)

    return NextResponse.json({ contact })
  } catch (error) {
    console.error("Failed to update contact", error)
    return NextResponse.json({ error: "Unable to update contact." }, { status: 500 })
  }
}

/**
 * DELETE /api/contacts/[contactId] — soft delete.
 *
 * `contact_outlets` and `contact_phone_numbers` rows are deliberately retained for
 * audit (PRD R9). Everything that reads contacts filters on `deleted_at IS NULL`, so
 * hiding the parent hides them too without touching the child rows.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const { contactId: rawId } = await params
  const contactId = parseContactId(rawId)
  if (contactId === null) {
    return NextResponse.json({ error: "Invalid contact id." }, { status: 400 })
  }

  try {
    const [result] = await queryWithReconnect(
      `UPDATE contacts
       SET deleted_at = CURRENT_TIMESTAMP(3), deleted_by_user_id = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [auth.user.id, contactId]
    )

    const affected = (result as { affectedRows?: number }).affectedRows ?? 0
    if (!affected) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("Failed to delete contact", error)
    return NextResponse.json({ error: "Unable to delete contact." }, { status: 500 })
  }
}
