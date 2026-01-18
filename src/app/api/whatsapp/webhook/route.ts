import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual, randomUUID } from "crypto"

import getPool from "@/lib/db"
import { normalizeWhatsAppNumber, stripWhatsAppPrefix } from "@/lib/whatsapp"

function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
) {
  const sortedKeys = Object.keys(params).sort()
  const data =
    url +
    sortedKeys
      .map((key) => `${key}${params[key] ?? ""}`)
      .join("")
  const digest = createHmac("sha1", authToken).update(data).digest("base64")
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL
  const signature = request.headers.get("x-twilio-signature")

  const formData = await request.formData()
  const payload: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      payload[key] = value
    }
  }

  if (authToken && webhookUrl && signature) {
    const isValid = verifyTwilioSignature(webhookUrl, payload, signature, authToken)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 403 })
    }
  }

  const from = payload.From?.trim()
  const to = payload.To?.trim()
  const body = payload.Body?.trim()
  const messageSid = payload.MessageSid?.trim()
  const profileName = payload.ProfileName?.trim()

  if (!from || !body) {
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  const contactNumber = normalizeWhatsAppNumber(from)
  const receiverNumber = to ? normalizeWhatsAppNumber(to) : null

  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT id
    FROM whatsapp_conversations
    WHERE contact_number = ?
    LIMIT 1
  `,
    [contactNumber]
  )

  let conversationId = (rows as Array<{ id: string }>)[0]?.id
  if (!conversationId) {
    conversationId = randomUUID()
    await pool.query(
      `
      INSERT INTO whatsapp_conversations (id, contact_number, contact_name)
      VALUES (?, ?, ?)
    `,
      [conversationId, contactNumber, profileName ?? null]
    )
  } else if (profileName) {
    await pool.query(
      `
      UPDATE whatsapp_conversations
      SET contact_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [profileName, conversationId]
    )
  }

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
    VALUES (?, ?, 'inbound', ?, 'received', ?, ?, ?)
  `,
    [
      randomUUID(),
      conversationId,
      body,
      messageSid ?? null,
      contactNumber,
      receiverNumber,
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
    [body.slice(0, 200), conversationId]
  )

  const [ticketRows] = await pool.query(
    `
    SELECT id, status, last_message_at, updated_at
    FROM tickets
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [conversationId]
  )

  const latestTicket = (ticketRows as Array<{
    id: string
    status: string
    last_message_at: string | null
    updated_at: string
  }>)[0]

  const now = Date.now()
  const thresholdMs = 7 * 24 * 60 * 60 * 1000
  const latestActivity = latestTicket?.last_message_at ?? latestTicket?.updated_at
  const latestTimestamp = latestActivity ? new Date(latestActivity).getTime() : 0
  const isClosed =
    latestTicket?.status === "resolved" || latestTicket?.status === "closed"
  const isStale = latestTimestamp
    ? now - latestTimestamp > thresholdMs
    : false

  if (!latestTicket || isClosed || isStale) {
    await pool.query(
      `
      INSERT INTO tickets (
        id,
        conversation_id,
        channel,
        customer_name,
        customer_phone,
        status,
        issue_description,
        last_message_at
      )
      VALUES (?, ?, 'whatsapp', ?, ?, 'new', ?, CURRENT_TIMESTAMP)
    `,
      [
        randomUUID(),
        conversationId,
        profileName ?? null,
        stripWhatsAppPrefix(contactNumber),
        body,
      ]
    )
  } else {
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

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}
