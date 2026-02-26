import { queryWithReconnect } from "@/lib/db"

export type TimeFilter = "all" | "period"

type OverviewRow = {
  total_tickets: number | string
  resolved_tickets: number | string
  avg_resolve_minutes: number | string | null
  active_days: number | string
  first_day: string | null
  last_day: string | null
}

type HourlyRow = {
  hour_of_day: number | string
  total: number | string
}

type MerchantOutletRow = {
  fid: string
  franchise_name: string
  oid: string
  outlet_name: string
  total: number | string
}

type IssueRow = {
  category: string
  subcategory1: string
  subcategory2: string
  total: number | string
  avg_resolve_minutes: number | string | null
}

type LabelCountRow = {
  label: string
  total: number | string
}

type MsRow = {
  ms_name: string
  total_tickets: number | string
  resolved_tickets: number | string
  avg_resolve_minutes: number | string | null
}

type DailyRow = {
  day: string
  total: number | string
}

type MonthRow = {
  month_value: string
}

export type AnalyticsData = {
  totalTickets: number
  resolvedTickets: number
  totalAvgResolveMinutes: number | null
  ticketsPerDay: number
  hourly: Array<{ hour: number; label: string; total: number }>
  busiestHour: { hour: number; label: string; total: number } | null
  merchants: Array<{ fid: string; franchiseName: string; total: number }>
  merchantOutlets: Array<{
    key: string
    fid: string
    franchiseName: string
    oid: string
    outletName: string
    total: number
  }>
  issues: Array<{
    issueLabel: string
    category: string
    subcategory1: string
    subcategory2: string
    total: number
    avgResolveMinutes: number | null
  }>
  topIssue: {
    issueLabel: string
    category: string
    subcategory1: string
    subcategory2: string
    total: number
    avgResolveMinutes: number | null
  } | null
  categoryBreakdown: Array<{ label: string; total: number }>
  subcategory1Breakdown: Array<{ label: string; total: number }>
  subcategory2Breakdown: Array<{ label: string; total: number }>
  msBreakdown: Array<{
    name: string
    totalTickets: number
    resolvedTickets: number
    avgResolveMinutes: number | null
    ticketsPerDay: number
  }>
  daily: Array<{ day: string; total: number }>
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function toValidDateInput(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export function toValidMonthInput(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null
  }

  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null
  }

  const [yearText, monthText] = value.split("-")
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null
  }

  if (month < 1 || month > 12) {
    return null
  }

  return value
}

export function getMonthDateRange(monthValue: string | null) {
  if (!monthValue) {
    return { fromDate: null, toDate: null }
  }

  const [yearText, monthText] = monthValue.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const startDate = `${monthValue}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const endDate = `${monthValue}-${String(lastDay).padStart(2, "0")}`

  return {
    fromDate: startDate,
    toDate: endDate,
  }
}

export async function getAnalyticsAvailableMonths() {
  const [rows] = await queryWithReconnect<MonthRow[]>(
    `
      SELECT DATE_FORMAT(support_requests.created_at, '%Y-%m') AS month_value
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      GROUP BY DATE_FORMAT(support_requests.created_at, '%Y-%m')
      ORDER BY month_value DESC
    `
  )

  return rows
    .map((row) => toValidMonthInput(row.month_value))
    .filter((value): value is string => Boolean(value))
}

function buildDateWhereClause(
  column: string,
  fromDate: string | null,
  toDate: string | null
) {
  const clauses: string[] = []
  const values: string[] = []

  if (fromDate) {
    clauses.push(`DATE(${column}) >= ?`)
    values.push(fromDate)
  }

  if (toDate) {
    clauses.push(`DATE(${column}) <= ?`)
    values.push(toDate)
  }

  if (!clauses.length) {
    return { sql: "", values }
  }

  return {
    sql: ` AND ${clauses.join(" AND ")}`,
    values,
  }
}

function formatHour(hour: number) {
  if (hour === 0) {
    return "12 AM"
  }
  if (hour < 12) {
    return `${hour} AM`
  }
  if (hour === 12) {
    return "12 PM"
  }
  return `${hour - 12} PM`
}

function toUtcDate(value: string | null) {
  if (!value) {
    return null
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed
}

function getWindowDays({
  filter,
  fromDate,
  toDate,
  firstDay,
  lastDay,
  activeDays,
}: {
  filter: TimeFilter
  fromDate: string | null
  toDate: string | null
  firstDay: string | null
  lastDay: string | null
  activeDays: number
}) {
  const from = toUtcDate(fromDate) ?? toUtcDate(firstDay)
  const to = toUtcDate(toDate) ?? toUtcDate(lastDay)

  if (from && to) {
    const start = from.getTime() <= to.getTime() ? from : to
    const end = from.getTime() <= to.getTime() ? to : from
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1)
  }

  if (filter === "period" && (fromDate || toDate)) {
    return Math.max(1, activeDays)
  }

  return Math.max(1, activeDays)
}

function normalizeLabel(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed || fallback
}

function topByCount<T extends { total: number }>(rows: T[]) {
  if (!rows.length) {
    return null
  }
  return rows.reduce((current, next) => (next.total > current.total ? next : current))
}

export async function getMerchantSuccessAnalyticsData({
  filter,
  fromDate,
  toDate,
}: {
  filter: TimeFilter
  fromDate: string | null
  toDate: string | null
}): Promise<AnalyticsData> {
  const applyPeriod = filter === "period"
  const dateFilter = applyPeriod
    ? buildDateWhereClause("support_requests.created_at", fromDate, toDate)
    : { sql: "", values: [] as string[] }

  const values = dateFilter.values

  const [
    [overviewRows],
    [hourlyRows],
    [merchantOutletRows],
    [issueRows],
    [categoryRows],
    [subcategory1Rows],
    [subcategory2Rows],
    [msRows],
    [dailyRows],
  ] = await Promise.all([
    queryWithReconnect<OverviewRow[]>(
      `
      SELECT
        COUNT(*) AS total_tickets,
        SUM(CASE WHEN support_requests.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
        AVG(
          CASE
            WHEN support_requests.status = 'Resolved' THEN TIMESTAMPDIFF(
              MINUTE,
              support_requests.created_at,
              COALESCE(support_requests.closed_at, support_requests.updated_at)
            )
            ELSE NULL
          END
        ) AS avg_resolve_minutes,
        COUNT(DISTINCT DATE(support_requests.created_at)) AS active_days,
        MIN(DATE(support_requests.created_at)) AS first_day,
        MAX(DATE(support_requests.created_at)) AS last_day
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
    `,
      values
    ),
    queryWithReconnect<HourlyRow[]>(
      `
      SELECT
        HOUR(support_requests.created_at) AS hour_of_day,
        COUNT(*) AS total
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY HOUR(support_requests.created_at)
      ORDER BY hour_of_day ASC
    `,
      values
    ),
    queryWithReconnect<MerchantOutletRow[]>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(support_requests.fid), ''), '--') AS fid,
        COALESCE(NULLIF(TRIM(support_requests.franchise_name_resolved), ''), 'Unknown franchise') AS franchise_name,
        COALESCE(NULLIF(TRIM(support_requests.oid), ''), '--') AS oid,
        COALESCE(NULLIF(TRIM(support_requests.outlet_name_resolved), ''), 'Unknown outlet') AS outlet_name,
        COUNT(*) AS total
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY
        COALESCE(NULLIF(TRIM(support_requests.fid), ''), '--'),
        COALESCE(NULLIF(TRIM(support_requests.franchise_name_resolved), ''), 'Unknown franchise'),
        COALESCE(NULLIF(TRIM(support_requests.oid), ''), '--'),
        COALESCE(NULLIF(TRIM(support_requests.outlet_name_resolved), ''), 'Unknown outlet')
      ORDER BY total DESC
    `,
      values
    ),
    queryWithReconnect<IssueRow[]>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(support_requests.issue_type), ''), 'Uncategorized') AS category,
        COALESCE(NULLIF(TRIM(support_requests.issue_subcategory1), ''), 'Unspecified') AS subcategory1,
        COALESCE(NULLIF(TRIM(support_requests.issue_subcategory2), ''), 'Unspecified') AS subcategory2,
        COUNT(*) AS total,
        AVG(
          CASE
            WHEN support_requests.status = 'Resolved' THEN TIMESTAMPDIFF(
              MINUTE,
              support_requests.created_at,
              COALESCE(support_requests.closed_at, support_requests.updated_at)
            )
            ELSE NULL
          END
        ) AS avg_resolve_minutes
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY
        COALESCE(NULLIF(TRIM(support_requests.issue_type), ''), 'Uncategorized'),
        COALESCE(NULLIF(TRIM(support_requests.issue_subcategory1), ''), 'Unspecified'),
        COALESCE(NULLIF(TRIM(support_requests.issue_subcategory2), ''), 'Unspecified')
      ORDER BY total DESC
    `,
      values
    ),
    queryWithReconnect<LabelCountRow[]>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(support_requests.issue_type), ''), 'Uncategorized') AS label,
        COUNT(*) AS total
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY COALESCE(NULLIF(TRIM(support_requests.issue_type), ''), 'Uncategorized')
      ORDER BY total DESC
      LIMIT 8
    `,
      values
    ),
    queryWithReconnect<LabelCountRow[]>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(support_requests.issue_subcategory1), ''), 'Unspecified') AS label,
        COUNT(*) AS total
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY COALESCE(NULLIF(TRIM(support_requests.issue_subcategory1), ''), 'Unspecified')
      ORDER BY total DESC
      LIMIT 8
    `,
      values
    ),
    queryWithReconnect<LabelCountRow[]>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(support_requests.issue_subcategory2), ''), 'Unspecified') AS label,
        COUNT(*) AS total
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY COALESCE(NULLIF(TRIM(support_requests.issue_subcategory2), ''), 'Unspecified')
      ORDER BY total DESC
      LIMIT 8
    `,
      values
    ),
    queryWithReconnect<MsRow[]>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(users.name), ''), 'Unassigned') AS ms_name,
        COUNT(*) AS total_tickets,
        SUM(CASE WHEN support_requests.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
        AVG(
          CASE
            WHEN support_requests.status = 'Resolved' THEN TIMESTAMPDIFF(
              MINUTE,
              support_requests.created_at,
              COALESCE(support_requests.closed_at, support_requests.updated_at)
            )
            ELSE NULL
          END
        ) AS avg_resolve_minutes
      FROM support_requests
      LEFT JOIN users
        ON users.id = support_requests.ms_pic_user_id
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY COALESCE(NULLIF(TRIM(users.name), ''), 'Unassigned')
      ORDER BY total_tickets DESC
    `,
      values
    ),
    queryWithReconnect<DailyRow[]>(
      `
      SELECT
        DATE(support_requests.created_at) AS day,
        COUNT(*) AS total
      FROM support_requests
      WHERE support_requests.hidden = FALSE
      ${dateFilter.sql}
      GROUP BY DATE(support_requests.created_at)
      ORDER BY day ASC
    `,
      values
    ),
  ])

  const overview = overviewRows[0]
  const totalTickets = toNumber(overview?.total_tickets)
  const resolvedTickets = toNumber(overview?.resolved_tickets)
  const totalAvgResolveMinutes = toNullableNumber(overview?.avg_resolve_minutes)
  const activeDays = toNumber(overview?.active_days)
  const windowDays = getWindowDays({
    filter,
    fromDate,
    toDate,
    firstDay: overview?.first_day ?? null,
    lastDay: overview?.last_day ?? null,
    activeDays,
  })

  const hourlyMap = new Map<number, number>()
  hourlyRows.forEach((row) => {
    hourlyMap.set(toNumber(row.hour_of_day), toNumber(row.total))
  })

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatHour(hour),
    total: hourlyMap.get(hour) ?? 0,
  }))

  const merchantMap = new Map<string, { fid: string; franchiseName: string; total: number }>()
  const merchantOutlets = merchantOutletRows.map((row) => {
    const fid = normalizeLabel(row.fid, "--")
    const franchiseName = normalizeLabel(row.franchise_name, "Unknown franchise")
    const total = toNumber(row.total)

    const existing = merchantMap.get(fid)
    if (existing) {
      existing.total += total
    } else {
      merchantMap.set(fid, { fid, franchiseName, total })
    }

    return {
      key: `${fid}-${normalizeLabel(row.oid, "--")}-${normalizeLabel(row.outlet_name, "Unknown outlet")}`,
      fid,
      franchiseName,
      oid: normalizeLabel(row.oid, "--"),
      outletName: normalizeLabel(row.outlet_name, "Unknown outlet"),
      total,
    }
  })

  const merchants = Array.from(merchantMap.values()).sort((a, b) => b.total - a.total)

  const issues = issueRows.map((row) => ({
    issueLabel: `${normalizeLabel(row.category, "Uncategorized")} / ${normalizeLabel(row.subcategory1, "Unspecified")} / ${normalizeLabel(row.subcategory2, "Unspecified")}`,
    category: normalizeLabel(row.category, "Uncategorized"),
    subcategory1: normalizeLabel(row.subcategory1, "Unspecified"),
    subcategory2: normalizeLabel(row.subcategory2, "Unspecified"),
    total: toNumber(row.total),
    avgResolveMinutes: toNullableNumber(row.avg_resolve_minutes),
  }))

  return {
    totalTickets,
    resolvedTickets,
    totalAvgResolveMinutes,
    ticketsPerDay: totalTickets / windowDays,
    hourly,
    busiestHour: topByCount(hourly),
    merchants,
    merchantOutlets,
    issues,
    topIssue: topByCount(issues),
    categoryBreakdown: categoryRows.map((row) => ({
      label: normalizeLabel(row.label, "Uncategorized"),
      total: toNumber(row.total),
    })),
    subcategory1Breakdown: subcategory1Rows.map((row) => ({
      label: normalizeLabel(row.label, "Unspecified"),
      total: toNumber(row.total),
    })),
    subcategory2Breakdown: subcategory2Rows.map((row) => ({
      label: normalizeLabel(row.label, "Unspecified"),
      total: toNumber(row.total),
    })),
    msBreakdown: msRows.map((row) => ({
      name: normalizeLabel(row.ms_name, "Unassigned"),
      totalTickets: toNumber(row.total_tickets),
      resolvedTickets: toNumber(row.resolved_tickets),
      avgResolveMinutes: toNullableNumber(row.avg_resolve_minutes),
      ticketsPerDay: toNumber(row.total_tickets) / windowDays,
    })),
    daily: dailyRows.map((row) => ({ day: row.day, total: toNumber(row.total) })),
  }
}
