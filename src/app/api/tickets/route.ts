import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim().toLowerCase() ?? ""
  const status = searchParams.get("status")?.trim()
  const startDate = searchParams.get("start_date")?.trim()
  const endDate = searchParams.get("end_date")?.trim()
  const pageParam = Number(searchParams.get("page") ?? "1")
  const perPageParam = Number(searchParams.get("per_page") ?? "25")

  const allowedPerPage = new Set([10, 25, 50, 100])
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const perPage = allowedPerPage.has(perPageParam) ? perPageParam : 25
  const offset = (page - 1) * perPage

  const whereClauses: string[] = []
  const values: Array<string | number> = []

  if (query) {
    const likeValue = `%${query}%`
    whereClauses.push(
      `(LOWER(tickets.customer_name) LIKE ? OR LOWER(tickets.customer_phone) LIKE ? OR LOWER(tickets.franchise_name) LIKE ? OR LOWER(tickets.outlet_name) LIKE ? OR LOWER(tickets.fid) LIKE ? OR LOWER(tickets.oid) LIKE ? OR LOWER(tickets.category) LIKE ? OR LOWER(tickets.subcategory_1) LIKE ? OR LOWER(tickets.subcategory_2) LIKE ?)`
    )
    values.push(
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue
    )
  }

  if (status && status !== "all") {
    whereClauses.push("tickets.status = ?")
    values.push(status)
  }

  if (startDate) {
    whereClauses.push("DATE(tickets.created_at) >= ?")
    values.push(startDate)
  }

  if (endDate) {
    whereClauses.push("DATE(tickets.created_at) <= ?")
    values.push(endDate)
  }

  const whereSql = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : ""

  const pool = getPool()

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) as total
    FROM tickets
    ${whereSql}
  `,
    values
  )

  const totalValue =
    (countRows as Array<{ total: number | string }>)[0]?.total ?? 0
  const total =
    typeof totalValue === "string" ? Number.parseInt(totalValue, 10) : totalValue

  const [rows] = await pool.query(
    `
    SELECT
      tickets.id,
      tickets.customer_name,
      tickets.customer_phone,
      tickets.franchise_name,
      tickets.outlet_name,
      tickets.fid,
      tickets.oid,
      tickets.status,
      tickets.category,
      tickets.subcategory_1,
      tickets.subcategory_2,
      tickets.created_at,
      tickets.last_message_at,
      users.name AS ms_agent_name
    FROM tickets
    LEFT JOIN users
      ON users.id = tickets.ms_agent_id
    ${whereSql}
    ORDER BY tickets.created_at DESC
    LIMIT ? OFFSET ?
  `,
    [...values, perPage, offset]
  )

  const tickets = (rows as Array<{
    id: string
    customer_name: string | null
    customer_phone: string | null
    franchise_name: string | null
    outlet_name: string | null
    fid: string | null
    oid: string | null
    status: string
    category: string | null
    subcategory_1: string | null
    subcategory_2: string | null
    created_at: string
    last_message_at: string | null
    ms_agent_name: string | null
  }>).map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    franchiseName: row.franchise_name,
    outletName: row.outlet_name,
    fid: row.fid,
    oid: row.oid,
    status: row.status,
    category: row.category,
    subcategory1: row.subcategory_1,
    subcategory2: row.subcategory_2,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    msAgentName: row.ms_agent_name,
  }))

  return NextResponse.json({
    tickets,
    total,
    page,
    perPage,
  })
}
