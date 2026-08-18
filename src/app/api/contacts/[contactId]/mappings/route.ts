import { NextRequest, NextResponse } from "next/server"

import {
  classifyMappingConflict,
  describeMappingConflict,
} from "@/lib/contact-mappings"
import type { MappingConflict } from "@/lib/contact-mappings"
import {
  cleanString,
  loadContactMappings,
  parseContactId,
  resolveContactsUser,
  withContactLock,
} from "../../helpers"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

/** GET /api/contacts/[contactId]/mappings */
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

  return NextResponse.json({ mappings: await loadContactMappings(contactId) })
}

/**
 * POST /api/contacts/[contactId]/mappings — attach an outlet or a whole franchise.
 *
 * `outletId: null` means franchise-wide. Overlap prevention runs INSIDE the contact
 * lock, because the database cannot express these rules: the UNIQUE key misses two
 * franchise-wide rows (MySQL treats NULLs as distinct) and says nothing about a
 * franchise-wide row colliding with outlet-specific ones. See
 * `src/lib/contact-mappings.ts`.
 *
 * A blocked attempt returns 409 with the offending existing rows so the dialog can
 * explain itself instead of just refusing (PRD AC5, AC12).
 */
export async function POST(
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
    franchiseId?: unknown
    outletId?: unknown
  } | null

  const franchiseId = cleanString(body?.franchiseId)
  const outletId = cleanString(body?.outletId)

  if (!franchiseId) {
    return NextResponse.json(
      { error: "A franchise id is required." },
      { status: 400 }
    )
  }

  type AddOutcome =
    | { kind: "not_found" }
    | { kind: "conflict"; conflict: MappingConflict }
    | { kind: "created"; mappingId: string }

  try {
    const outcome = await withContactLock<AddOutcome>(contactId, async (connection) => {
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [contactId]
      )
      if (!existing.length) {
        return { kind: "not_found" }
      }

      const mappings = await loadContactMappings(contactId, connection)
      const conflict = classifyMappingConflict(mappings, { franchiseId, outletId })

      if (conflict.reason !== "none") {
        return { kind: "conflict", conflict }
      }

      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO contact_outlets (contact_id, franchise_id, outlet_id, created_by_user_id)
         VALUES (?, ?, ?, ?)`,
        [contactId, franchiseId, outletId, auth.user.id]
      )

      return { kind: "created", mappingId: String(result.insertId) }
    })

    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 })
    }

    if (outcome.kind === "conflict") {
      return NextResponse.json(
        {
          error:
            describeMappingConflict(outcome.conflict) ??
            "This mapping conflicts with an existing one.",
          conflict: outcome.conflict.reason,
          existing: outcome.conflict.conflicting,
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { mappings: await loadContactMappings(contactId) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to add contact mapping", error)
    return NextResponse.json({ error: "Unable to add mapping." }, { status: 500 })
  }
}
