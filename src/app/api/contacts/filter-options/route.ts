import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import { resolveContactsUser } from "../helpers"
import type { RowDataPacket } from "mysql2/promise"

/**
 * GET /api/contacts/filter-options — populates the directory's filter selects.
 *
 * Mirrors `/api/leads/filter-options`: the lists are derived from the data actually
 * present, so a filter can never offer a value that yields zero rows.
 *
 * Franchises and outlets come from `contact_outlets` joined to the local merchant
 * cache, not from the full merchant list — filtering by a franchise nobody is mapped
 * to is not a useful option, and the full list is thousands of rows.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const [roleRows] = await queryWithReconnect<
    Array<RowDataPacket & { role: string }>
  >(
    `SELECT DISTINCT role
     FROM contacts
     WHERE deleted_at IS NULL AND role IS NOT NULL AND TRIM(role) <> ''
     ORDER BY role ASC`
  )

  const [franchiseRows] = await queryWithReconnect<
    Array<RowDataPacket & { franchise_id: string; franchise_name: string | null }>
  >(
    `SELECT
       contact_outlets.franchise_id,
       MAX(merchants.name) AS franchise_name
     FROM contact_outlets
     INNER JOIN contacts
       ON contacts.id = contact_outlets.contact_id AND contacts.deleted_at IS NULL
     LEFT JOIN merchants
       ON merchants.fid = contact_outlets.franchise_id
       OR merchants.external_id = contact_outlets.franchise_id
     GROUP BY contact_outlets.franchise_id
     ORDER BY franchise_name ASC, contact_outlets.franchise_id ASC`
  )

  const [outletRows] = await queryWithReconnect<
    Array<
      RowDataPacket & {
        outlet_id: string
        franchise_id: string
        outlet_name: string | null
      }
    >
  >(
    `SELECT
       contact_outlets.outlet_id,
       contact_outlets.franchise_id,
       MAX(merchant_outlets.name) AS outlet_name
     FROM contact_outlets
     INNER JOIN contacts
       ON contacts.id = contact_outlets.contact_id AND contacts.deleted_at IS NULL
     LEFT JOIN merchant_outlets
       ON merchant_outlets.external_id = contact_outlets.outlet_id
     WHERE contact_outlets.outlet_id IS NOT NULL
     GROUP BY contact_outlets.outlet_id, contact_outlets.franchise_id
     ORDER BY outlet_name ASC, contact_outlets.outlet_id ASC`
  )

  return NextResponse.json({
    roles: roleRows.map((row) => row.role),
    franchises: franchiseRows.map((row) => ({
      id: row.franchise_id,
      name: row.franchise_name ?? `FID ${row.franchise_id}`,
    })),
    outlets: outletRows.map((row) => ({
      id: row.outlet_id,
      franchiseId: row.franchise_id,
      name: row.outlet_name ?? `OID ${row.outlet_id}`,
    })),
  })
}
