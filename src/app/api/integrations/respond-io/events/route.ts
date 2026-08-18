import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import { resolveIntegrationsUser } from "../helpers"
import type { RowDataPacket } from "mysql2/promise"

const ALLOWED_PER_PAGE = new Set([10, 25, 50, 100])

type EventRow = RowDataPacket & {
  id: number | string
  event_type: string
  respondio_contact_id: string | null
  secret_valid: number
  processing_status: string
  result_summary: string | null
  error_message: string | null
  ticket_id: number | string | null
  received_at: string
  processed_at: string | null
}

/**
 * GET /api/integrations/respond-io/events — the settings page's event log.
 *
 * `payload_raw` is deliberately NOT returned. It is retained in the table for
 * troubleshooting, but it holds merchant phone numbers and names, and the log is a
 * read-only operational view — not somewhere to re-expose contact data to anyone with
 * the `/integrations` key.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveIntegrationsUser(request, false)
  if ("response" in auth) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const pageParam = Number(searchParams.get("page") ?? "1")
  const perPageParam = Number(searchParams.get("per_page") ?? "25")
  const status = searchParams.get("status")?.trim() ?? ""

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const perPage = ALLOWED_PER_PAGE.has(perPageParam) ? perPageParam : 25
  const offset = (page - 1) * perPage

  const whereClauses: string[] = []
  const whereValues: Array<string | number> = []

  if (status) {
    whereClauses.push("processing_status = ?")
    whereValues.push(status)
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""

  const [countRows] = await queryWithReconnect<
    Array<RowDataPacket & { total: number | string }>
  >(
    `SELECT COUNT(*) AS total FROM respondio_webhook_events ${whereSql}`,
    whereValues
  )

  const rawTotal = countRows[0]?.total ?? 0
  const total =
    typeof rawTotal === "string" ? Number.parseInt(rawTotal, 10) || 0 : rawTotal

  const [rows] = await queryWithReconnect<EventRow[]>(
    `SELECT
       id, event_type, respondio_contact_id, secret_valid, processing_status,
       result_summary, error_message, ticket_id, received_at, processed_at
     FROM respondio_webhook_events
     ${whereSql}
     ORDER BY received_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...whereValues, perPage, offset]
  )

  return NextResponse.json({
    events: rows.map((row) => ({
      id: String(row.id),
      eventType: row.event_type,
      respondioContactId: row.respondio_contact_id,
      secretValid: Number(row.secret_valid) === 1,
      status: row.processing_status,
      result: row.result_summary ?? row.error_message,
      ticketId: row.ticket_id ? String(row.ticket_id) : null,
      receivedAt: row.received_at,
      processedAt: row.processed_at,
    })),
    total,
    page,
    perPage,
  })
}
