import { NextRequest, NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth"
import { queryWithReconnect } from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"

type ContactScopeRow = RowDataPacket & {
  id: number | string
  name: string
  email: string
  role: string | null
  primary_phone: string | null
  franchise_wide: number
}

/**
 * GET /api/merchants/[merchantId]/contacts?oid=<outletId>
 *
 * Reverse lookup for the merchant page (PRD 4.5). Returns contacts mapped to the
 * given outlet **and** contacts mapped to the whole franchise, since a franchise-wide
 * mapping represents every outlet under it (AC6, AC11). Without `oid` it returns every
 * contact mapped anywhere under the franchise.
 *
 * `merchantId` is the route's franchise id, matched against `merchants.fid` or
 * `merchants.external_id` exactly as `buildMerchantOutletResolver` does — never the
 * surrogate `merchants.id`, which can collide with a different merchant's fid.
 *
 * Gated on plain authentication rather than the `/contacts` key: this is a panel on the
 * merchant page, and someone who can already see the merchant should see who represents
 * it. The link through to a contact's own page is still gated by `/contacts`.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ merchantId: string }> }
) {
  const user = await requireAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { merchantId } = await context.params
  const { searchParams } = new URL(request.url)
  const outletId = searchParams.get("oid")?.trim() ?? ""

  const franchiseIds = await resolveFranchiseIds(merchantId)
  if (!franchiseIds.length) {
    return NextResponse.json({ contacts: [] })
  }

  const franchisePlaceholders = franchiseIds.map(() => "?").join(", ")
  const scopeSql = outletId
    ? `AND (contact_outlets.outlet_id = ? OR contact_outlets.outlet_id IS NULL)`
    : ""
  const scopeValues = outletId ? [outletId] : []

  const [rows] = await queryWithReconnect<ContactScopeRow[]>(
    `SELECT
       contacts.id,
       contacts.name,
       contacts.email,
       contacts.role,
       (
         SELECT phone FROM contact_phone_numbers
         WHERE contact_phone_numbers.contact_id = contacts.id
         ORDER BY is_primary DESC, id ASC
         LIMIT 1
       ) AS primary_phone,
       MAX(contact_outlets.outlet_id IS NULL) AS franchise_wide
     FROM contact_outlets
     INNER JOIN contacts
       ON contacts.id = contact_outlets.contact_id
     WHERE contacts.deleted_at IS NULL
       AND contact_outlets.franchise_id IN (${franchisePlaceholders})
       ${scopeSql}
     GROUP BY contacts.id, contacts.name, contacts.email, contacts.role
     ORDER BY franchise_wide DESC, contacts.name ASC`,
    [...franchiseIds, ...scopeValues]
  )

  return NextResponse.json({
    contacts: rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      email: row.email,
      role: row.role,
      primaryPhone: row.primary_phone,
      // Drives the design's "Franchise-wide" vs "This outlet" badge.
      franchiseWide: Number(row.franchise_wide) === 1,
    })),
  })
}

/**
 * A merchant is addressable by either `fid` or `external_id`, and mappings may have
 * been stored under either. Returning both (deduped) means a mapping written from one
 * surface is still found from the other.
 */
async function resolveFranchiseIds(merchantId: string): Promise<string[]> {
  const [rows] = await queryWithReconnect<
    Array<RowDataPacket & { external_id: string; fid: string | null }>
  >(
    `SELECT external_id, fid FROM merchants WHERE fid = ? OR external_id = ? LIMIT 1`,
    [merchantId, merchantId]
  )

  const merchant = rows[0]
  const candidates = merchant
    ? [merchant.external_id, merchant.fid, merchantId]
    : [merchantId]

  return [...new Set(candidates.filter((value): value is string => Boolean(value)))]
}
