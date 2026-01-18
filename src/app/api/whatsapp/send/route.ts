import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

import getPool from "@/lib/db"
import { normalizeWhatsAppNumber } from "@/lib/whatsapp"

type ConversationRow = {
  id: string
  contact_number: string
}

type TwilioResponse = {
  sid?: string
  status?: string
  code?: number
  message?: string
  error_message?: string
  more_info?: string
}

async function sendTwilioMessage(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio WhatsApp settings are missing.")
  }

  const from = normalizeWhatsAppNumber(fromNumber)
  const params = new URLSearchParams()
  params.set("From", from)
  params.set("To", to)
  params.set("Body", body)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${accountSid}:${authToken}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  )

  const payload = (await response.json()) as TwilioResponse
  if (!response.ok) {
    const details = [
      payload.error_message ?? payload.message,
      payload.code ? `code ${payload.code}` : null,
      payload.more_info ?? null,
    ]
      .filter(Boolean)
      .join(" | ")
    throw new Error(details || `Unable to send WhatsApp message (status ${response.status}).`)
  }
  return payload
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json()) as {
    conversationId?: string
    to?: string
    body?: string
  }

  const messageBody = body.body?.trim()
  if (!messageBody) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 })
  }

  const pool = getPool()
  let conversation: ConversationRow | null = null
  let contactNumber = body.to?.trim() ?? ""

  if (body.conversationId) {
    const [rows] = await pool.query(
      `
      SELECT id, contact_number
      FROM whatsapp_conversations
      WHERE id = ?
      LIMIT 1
    `,
      [body.conversationId]
    )
    conversation = (rows as ConversationRow[])[0] ?? null
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 })
    }
    contactNumber = conversation.contact_number
  } else if (contactNumber) {
    contactNumber = normalizeWhatsAppNumber(contactNumber)
    const [rows] = await pool.query(
      `
      SELECT id, contact_number
      FROM whatsapp_conversations
      WHERE contact_number = ?
      LIMIT 1
    `,
      [contactNumber]
    )
    conversation = (rows as ConversationRow[])[0] ?? null
  }

  if (!contactNumber) {
    return NextResponse.json({ error: "Destination number is required." }, { status: 400 })
  }

  contactNumber = normalizeWhatsAppNumber(contactNumber)

  if (!conversation) {
    const newId = randomUUID()
    await pool.query(
      `
      INSERT INTO whatsapp_conversations (id, contact_number)
      VALUES (?, ?)
    `,
      [newId, contactNumber]
    )
    conversation = { id: newId, contact_number: contactNumber }
  }

  const result = await sendTwilioMessage(contactNumber, messageBody)
  const providerMessageId = result.sid ?? null
  const status = result.status ?? "queued"

  await pool.query(
    `
    INSERT INTO whatsapp_messages (
      id,
      conversation_id,
      direction,
      body,
      status,
      provider_message_id,
      sender_number,
      receiver_number
    )
    VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?)
  `,
    [
      randomUUID(),
      conversation.id,
      messageBody,
      status,
      providerMessageId,
      process.env.TWILIO_WHATSAPP_NUMBER
        ? normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_NUMBER)
        : null,
      contactNumber,
    ]
  )

  await pool.query(
    `
    UPDATE whatsapp_conversations
    SET last_message_at = CURRENT_TIMESTAMP,
        last_message_preview = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    [messageBody.slice(0, 200), conversation.id]
  )

  const [ticketRows] = await pool.query(
    `
    SELECT id, status, last_message_at, updated_at
    FROM tickets
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [conversation.id]
  )

  const latestTicket = (ticketRows as Array<{
    id: string
    status: string
    last_message_at: string | null
    updated_at: string
  }>)[0]

  if (
    latestTicket &&
    latestTicket.status !== "resolved" &&
    latestTicket.status !== "closed"
  ) {
    await pool.query(
      `
      UPDATE tickets
      SET last_message_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [latestTicket.id]
    )
  }

  return NextResponse.json({ ok: true })
}
