import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import {
  buildContactScopeClause,
  buildContactSearchClause,
  contactSelectSql,
  findDuplicateContacts,
  validateContactInput,
} from "@/lib/contacts"
import type { ContactRow } from "@/lib/contacts"
import {
  attachPhones,
  cleanString,
  resolveContactsUser,
  withTransaction,
} from "./helpers"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

const ALLOWED_PER_PAGE = new Set([10, 25, 50, 100])

/**
 * GET /api/contacts — the directory listing.
 *
 * Supports free-text search (name / email / phone / role), plus franchise, outlet and
 * role filters. Soft-deleted contacts are excluded everywhere (PRD AC7).
 */
export async function GET(request: NextRequest) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const pageParam = Number(searchParams.get("page") ?? "1")
  const perPageParam = Number(searchParams.get("per_page") ?? "25")
  const query = searchParams.get("q")?.trim() ?? ""
  const franchiseId = searchParams.get("fid")?.trim() ?? ""
  const outletId = searchParams.get("oid")?.trim() ?? ""
  const role = searchParams.get("role")?.trim() ?? ""

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const perPage = ALLOWED_PER_PAGE.has(perPageParam) ? perPageParam : 25
  const offset = (page - 1) * perPage

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

  if (role) {
    whereClauses.push("LOWER(COALESCE(contacts.role, '')) = ?")
    whereValues.push(role.toLowerCase())
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`

  const [countRows] = await queryWithReconnect<
    Array<RowDataPacket & { total: number | string }>
  >(`SELECT COUNT(*) AS total FROM contacts ${whereSql}`, whereValues)

  const rawTotal = countRows[0]?.total ?? 0
  const total =
    typeof rawTotal === "string" ? Number.parseInt(rawTotal, 10) || 0 : rawTotal

  const [rows] = await queryWithReconnect<ContactRow[]>(
    `${contactSelectSql}
     ${whereSql}
     ORDER BY contacts.name ASC, contacts.id ASC
     LIMIT ? OFFSET ?`,
    [...whereValues, perPage, offset]
  )

  return NextResponse.json({
    contacts: await attachPhones(rows),
    total,
    page,
    perPage,
  })
}

/**
 * POST /api/contacts — create a contact.
 *
 * A phone or email that matches an existing non-deleted contact BLOCKS creation and
 * returns 409 with every match, so the UI can name them and offer to open one instead
 * (PRD 4.2, AC1/AC2). Both the check and the insert run inside one transaction:
 * checking outside it lets two near-simultaneous submissions of the same phone both
 * pass.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveContactsUser(request)
  if ("response" in auth) {
    return auth.response
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
    const created = await withTransaction(async (connection) => {
      const matches = await findDuplicateContacts(connection, {
        email: input.email,
        phonesNormalized: input.phones.map((phone) => phone.phoneNormalized),
      })

      if (matches.length) {
        return { matches }
      }

      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO contacts (name, email, role, source, created_by_user_id)
         VALUES (?, ?, ?, 'staff', ?)`,
        [input.name, input.email, input.role, auth.user.id]
      )

      const contactId = result.insertId

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

      return { contactId }
    })

    if ("matches" in created) {
      return NextResponse.json(
        {
          error:
            "A contact with this phone number or email already exists. Use that contact instead of creating a duplicate.",
          matches: created.matches,
        },
        { status: 409 }
      )
    }

    const [rows] = await queryWithReconnect<ContactRow[]>(
      `${contactSelectSql} WHERE contacts.id = ? LIMIT 1`,
      [created.contactId]
    )
    const [contact] = await attachPhones(rows)

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    console.error("Failed to create contact", error)
    return NextResponse.json(
      { error: "Unable to create contact." },
      { status: 500 }
    )
  }
}
