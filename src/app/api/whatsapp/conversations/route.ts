import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"
import { stripWhatsAppPrefix } from "@/lib/whatsapp"

type ConversationRow = {
  id: string
  contact_number: string
  contact_name: string | null
  last_message_at: string | null
  last_message_preview: string | null
  ticket_id: string | null
  ticket_status: string | null
  ticket_category: string | null
  ticket_subcategory_1: string | null
  ticket_fid: string | null
  ticket_oid: string | null
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim().toLowerCase() ?? ""

  const pool = getPool()
  const whereClauses: string[] = []
  const values: string[] = []

  if (query) {
    const likeValue = `%${query}%`
    whereClauses.push(
      "(LOWER(contact_name) LIKE ? OR LOWER(contact_number) LIKE ? OR LOWER(last_message_preview) LIKE ?)"
    )
    values.push(likeValue, likeValue, likeValue)
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""

  const [rows] = await pool.query(
    `
    SELECT
      whatsapp_conversations.id,
      whatsapp_conversations.contact_number,
      whatsapp_conversations.contact_name,
      whatsapp_conversations.last_message_at,
      whatsapp_conversations.last_message_preview,
      latest_ticket.id AS ticket_id,
      latest_ticket.status AS ticket_status,
      latest_ticket.category AS ticket_category,
      latest_ticket.subcategory_1 AS ticket_subcategory_1,
      latest_ticket.fid AS ticket_fid,
      latest_ticket.oid AS ticket_oid
    FROM whatsapp_conversations
    LEFT JOIN (
      SELECT t1.*
      FROM tickets t1
      INNER JOIN (
        SELECT conversation_id, MAX(created_at) AS max_created_at
        FROM tickets
        GROUP BY conversation_id
      ) t2
        ON t1.conversation_id = t2.conversation_id
       AND t1.created_at = t2.max_created_at
    ) AS latest_ticket
      ON latest_ticket.conversation_id = whatsapp_conversations.id
    ${whereSql}
    ORDER BY COALESCE(whatsapp_conversations.last_message_at, whatsapp_conversations.updated_at) DESC
  `,
    values
  )

  const conversations = (rows as ConversationRow[]).map((row) => ({
    id: row.id,
    contactNumber: stripWhatsAppPrefix(row.contact_number),
    contactName: row.contact_name,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    ticket: row.ticket_id
      ? {
          id: row.ticket_id,
          status: row.ticket_status,
          category: row.ticket_category,
          subcategory1: row.ticket_subcategory_1,
          fid: row.ticket_fid,
          oid: row.ticket_oid,
        }
      : null,
  }))

  return NextResponse.json({ conversations })
}
