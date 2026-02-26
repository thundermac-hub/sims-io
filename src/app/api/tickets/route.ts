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
  const archive = searchParams.get("archive")?.trim()
  const clickup = searchParams.get("clickup")?.trim()
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
      `(LOWER(support_requests.merchant_name) LIKE ? OR LOWER(support_requests.phone_number) LIKE ? OR LOWER(support_requests.franchise_name_resolved) LIKE ? OR LOWER(support_requests.outlet_name_resolved) LIKE ? OR LOWER(support_requests.fid) LIKE ? OR LOWER(support_requests.oid) LIKE ? OR LOWER(support_requests.issue_type) LIKE ? OR LOWER(support_requests.issue_subcategory1) LIKE ? OR LOWER(support_requests.issue_subcategory2) LIKE ?)`
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
    whereClauses.push("support_requests.status = ?")
    values.push(status)
  }

  if (archive === "active") {
    whereClauses.push("support_requests.hidden = FALSE")
  } else if (archive === "archived") {
    whereClauses.push("support_requests.hidden = TRUE")
  }

  if (clickup === "with") {
    whereClauses.push(
      `(
        (support_requests.clickup_task_id IS NOT NULL AND support_requests.clickup_task_id <> '')
        OR (support_requests.clickup_link IS NOT NULL AND support_requests.clickup_link <> '')
      )`
    )
  } else if (clickup === "without") {
    whereClauses.push(
      `(
        (support_requests.clickup_task_id IS NULL OR support_requests.clickup_task_id = '')
        AND (support_requests.clickup_link IS NULL OR support_requests.clickup_link = '')
      )`
    )
  }

  if (startDate) {
    whereClauses.push("DATE(support_requests.created_at) >= ?")
    values.push(startDate)
  }

  if (endDate) {
    whereClauses.push("DATE(support_requests.created_at) <= ?")
    values.push(endDate)
  }

  const whereSql = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : ""

  const pool = getPool()

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) as total
    FROM support_requests
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
      support_requests.id,
      support_requests.merchant_name AS customer_name,
      support_requests.phone_number AS customer_phone,
      support_requests.franchise_name_resolved AS franchise_name,
      support_requests.outlet_name_resolved AS outlet_name,
      support_requests.fid,
      support_requests.oid,
      support_requests.status,
      support_requests.hidden,
      support_requests.issue_type AS category,
      support_requests.issue_subcategory1 AS subcategory_1,
      support_requests.issue_subcategory2 AS subcategory_2,
      support_requests.clickup_link,
      support_requests.clickup_task_id,
      support_requests.clickup_task_status,
      COALESCE(support_requests.closed_at, support_requests.updated_at) AS resolved_at,
      support_requests.created_at,
      support_requests.updated_at AS last_message_at,
      users.name AS ms_agent_name
    FROM support_requests
    LEFT JOIN users
      ON users.id = support_requests.ms_pic_user_id
    ${whereSql}
    ORDER BY support_requests.created_at DESC
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
    hidden: number
    category: string | null
    subcategory_1: string | null
    subcategory_2: string | null
    clickup_link: string | null
    clickup_task_id: string | null
    clickup_task_status: string | null
    resolved_at: string | null
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
    hidden: Boolean(row.hidden),
    category: row.category,
    subcategory1: row.subcategory_1,
    subcategory2: row.subcategory_2,
    clickupLink: row.clickup_link,
    clickupTaskId: row.clickup_task_id,
    clickupTaskStatus: row.clickup_task_status,
    resolvedAt: row.resolved_at,
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
