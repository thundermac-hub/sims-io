import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import {
  buildContactScopeClause,
  buildContactSearchClause,
  contactSelectSql,
} from "@/lib/contacts"
import type { ContactRow } from "@/lib/contacts"
import {
  attachPhones,
  loadMappingCounts,
  resolveContactsUser,
} from "../helpers"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/**
 * GET /api/contacts/search — the shared contact picker endpoint (PRD 4.6).
 *
 * This is what Sales, Renewal & Retention and Merchant Success query. It is
 * deliberately separate from `GET /api/contacts`: the picker wants a small, flat,
 * fast result set for typeahead, not the paginated directory payload with totals.
 *
 * Optional `fid` / `oid` scope the results to a franchise or outlet. Scoping to an
 * outlet matches franchise-wide mappings too, since a franchise-wide contact
 * represents every outlet under it.
 *
 * Soft-deleted contacts never appear (PRD AC7).
 */
export async function GET(request: NextRequest) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const franchiseId = searchParams.get("fid")?.trim() ?? ""
  const outletId = searchParams.get("oid")?.trim() ?? ""
  const limitParam = Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT))
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT

  const whereClauses = ["contacts.deleted_at IS NULL"]
  const whereValues: Array<string | number> = []

  if (query) {
    const search = buildContactSearchClause(query)
    whereClauses.push(search.sql)
    whereValues.push(...search.values)
  }

  const scope = buildContactScopeClause(franchiseId || null, outletId || null)
  if (scope) {
    whereClauses.push(scope.sql)
    whereValues.push(...scope.values)
  }

  const [rows] = await queryWithReconnect<ContactRow[]>(
    `${contactSelectSql}
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY contacts.name ASC, contacts.id ASC
     LIMIT ?`,
    [...whereValues, limit]
  )

  const contacts = await attachPhones(rows)
  const counts = await loadMappingCounts(contacts.map((contact) => contact.id))

  return NextResponse.json({
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      role: contact.role,
      phones: contact.phones.map((phone) => phone.phone),
      mappingCount: counts.get(contact.id) ?? 0,
    })),
  })
}
