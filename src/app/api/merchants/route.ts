import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageParam = Number(searchParams.get("page") ?? "1")
  const perPageParam = Number(searchParams.get("per_page") ?? "25")
  const query = searchParams.get("q")?.trim() ?? ""
  const sortParam = searchParams.get("sort") ?? "fid"
  const directionParam = searchParams.get("direction") ?? "desc"

  const allowedPerPage = new Set([10, 25, 50, 100])
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const perPage = allowedPerPage.has(perPageParam) ? perPageParam : 25
  const offset = (page - 1) * perPage

  const pool = getPool()

  const whereClauses: string[] = []
  const whereValues: Array<string | number> = []

  if (query) {
    const likeValue = `%${query.toLowerCase()}%`
    whereClauses.push(
      `(LOWER(name) LIKE ? OR LOWER(fid) LIKE ? OR LOWER(external_id) LIKE ? OR LOWER(CAST(raw_payload AS CHAR)) LIKE ? OR EXISTS (
        SELECT 1
        FROM merchant_outlets
        WHERE merchant_outlets.merchant_external_id = merchants.external_id
          AND LOWER(merchant_outlets.name) LIKE ?
      ))`
    )
    whereValues.push(
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue
    )
  }

  const whereSql = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : ""

  const allowedSorts = new Set(["fid", "name"])
  const sortField = allowedSorts.has(sortParam) ? sortParam : "fid"
  const sortDirection = directionParam === "asc" ? "ASC" : "DESC"
  const orderBySql =
    sortField === "fid"
      ? `ORDER BY fid IS NULL, CAST(fid AS UNSIGNED) ${sortDirection}, fid ${sortDirection}`
      : `ORDER BY name ${sortDirection}`

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) as total
    FROM merchants
    ${whereSql}
  `,
    whereValues
  )

  const totalValue =
    (countRows as Array<{ total: number | string }>)[0]?.total ?? 0
  const total =
    typeof totalValue === "string" ? Number.parseInt(totalValue, 10) : totalValue

  const [merchantRows] = await pool.query(
    `
    SELECT id, external_id, name, fid, outlet_count, status, raw_payload, created_at, updated_at
    FROM merchants
    ${whereSql}
    ${orderBySql}
    LIMIT ? OFFSET ?
  `
    ,
    [...whereValues, perPage, offset]
  )

  const [importRows] = await pool.query(
    `
    SELECT completed_at
    FROM merchant_import_runs
    WHERE status = 'success'
    ORDER BY completed_at DESC
    LIMIT 1
  `
  )

  const lastUpdated = (importRows as Array<{ completed_at: string }>)[0]
    ?.completed_at

  const merchants = (merchantRows as Array<{
    id: string
    external_id: string
    name: string
    fid: string | null
    outlet_count: number
    status: string | null
    raw_payload: unknown
    created_at: string
    updated_at: string
  }>).map((row) => {
    let payload: Record<string, unknown> | null = null
    if (typeof row.raw_payload === "string") {
      try {
        payload = JSON.parse(row.raw_payload) as Record<string, unknown>
      } catch {
        payload = null
      }
    } else if (row.raw_payload && typeof row.raw_payload === "object") {
      payload = row.raw_payload as Record<string, unknown>
    }

    const outlets = payload?.outlets
    const outletCount = Array.isArray(outlets)
      ? outlets.length
      : outlets && typeof outlets === "object"
        ? 1
        : row.outlet_count

    return {
      id: row.id,
      external_id: row.external_id,
      name: row.name,
      fid: row.fid,
      outlet_count: outletCount,
      status: row.status,
      created_at: (payload?.created_at as string | null) ?? row.created_at,
      updated_at: row.updated_at,
      details: {
        company: payload?.company ?? null,
        company_address: payload?.company_address ?? null,
        country: payload?.country ?? null,
        timezone_offset: payload?.timezone_offset ?? null,
        slug: payload?.slug ?? null,
        closed_account: payload?.closed_account ?? null,
        test_account: payload?.test_account ?? null,
      },
    }
  })

  return NextResponse.json({
    merchants,
    lastUpdated: lastUpdated ?? null,
    total,
    page,
    perPage,
    sort: sortField,
    direction: sortDirection.toLowerCase(),
  })
}
