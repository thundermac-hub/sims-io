import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import {
  loadContactMappings,
  parseContactId,
  resolveContactsUser,
} from "../../../helpers"

/**
 * DELETE /api/contacts/[contactId]/mappings/[mappingId]
 *
 * Removing a mapping leaves the contact and its other mappings untouched, and an
 * unmapped contact stays visible in the directory (PRD edge case: "removing a
 * contact's only mapping").
 *
 * The `contact_id` is part of the WHERE clause, not just the path, so a mapping id
 * from another contact cannot be deleted through this route.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; mappingId: string }> }
) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const { contactId: rawContactId, mappingId: rawMappingId } = await params
  const contactId = parseContactId(rawContactId)
  const mappingId = parseContactId(rawMappingId)

  if (contactId === null || mappingId === null) {
    return NextResponse.json({ error: "Invalid identifier." }, { status: 400 })
  }

  try {
    const [result] = await queryWithReconnect(
      `DELETE FROM contact_outlets WHERE id = ? AND contact_id = ?`,
      [mappingId, contactId]
    )

    const affected = (result as { affectedRows?: number }).affectedRows ?? 0
    if (!affected) {
      return NextResponse.json({ error: "Mapping not found." }, { status: 404 })
    }

    return NextResponse.json({ mappings: await loadContactMappings(contactId) })
  } catch (error) {
    console.error("Failed to remove contact mapping", error)
    return NextResponse.json({ error: "Unable to remove mapping." }, { status: 500 })
  }
}
