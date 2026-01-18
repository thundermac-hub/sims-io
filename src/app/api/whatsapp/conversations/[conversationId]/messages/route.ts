import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"
import { stripWhatsAppPrefix } from "@/lib/whatsapp"

type MessageRow = {
  id: string
  direction: "inbound" | "outbound"
  body: string
  status: string | null
  sender_number: string | null
  receiver_number: string | null
  created_at: string
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { conversationId } = await context.params
  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT id, direction, body, status, sender_number, receiver_number, created_at
    FROM whatsapp_messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `,
    [conversationId]
  )

  const messages = (rows as MessageRow[]).map((row) => ({
    id: row.id,
    direction: row.direction,
    body: row.body,
    status: row.status,
    senderNumber: stripWhatsAppPrefix(row.sender_number),
    receiverNumber: stripWhatsAppPrefix(row.receiver_number),
    createdAt: row.created_at,
  }))

  return NextResponse.json({ messages })
}
