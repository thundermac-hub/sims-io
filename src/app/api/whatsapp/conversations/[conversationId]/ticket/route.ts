import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"

const TICKET_STATUSES = new Set([
  "new",
  "open",
  "pending_merchant",
  "pending_internal",
  "resolved",
  "closed",
])

type TicketRow = {
  id: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  franchise_name: string | null
  outlet_name: string | null
  fid: string | null
  oid: string | null
  ms_agent_id: string | null
  ms_agent_name: string | null
  category: string | null
  subcategory_1: string | null
  subcategory_2: string | null
  issue_description: string | null
  internal_notes: string | null
  csat_link: string | null
  csat_score: number | null
  csat_response: string | null
}

type TicketUpdatePayload = {
  customerName?: string
  customerPhone?: string
  franchiseName?: string
  outletName?: string
  fid?: string
  oid?: string
  msAgentName?: string
  status?: string
  category?: string
  subcategory1?: string
  subcategory2?: string
  issueDescription?: string
  internalNotes?: string
  csatLink?: string
  csatScore?: number | string | null
  csatResponse?: string
}

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseCsatScore = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return Math.round(parsed)
    }
  }
  return undefined
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
    SELECT
      tickets.id,
      tickets.status,
      tickets.customer_name,
      tickets.customer_phone,
      tickets.franchise_name,
      tickets.outlet_name,
      tickets.fid,
      tickets.oid,
      tickets.ms_agent_id,
      users.name AS ms_agent_name,
      tickets.category,
      tickets.subcategory_1,
      tickets.subcategory_2,
      tickets.issue_description,
      tickets.internal_notes,
      tickets.csat_link,
      tickets.csat_score,
      tickets.csat_response
    FROM tickets
    LEFT JOIN users
      ON users.id = tickets.ms_agent_id
    WHERE tickets.conversation_id = ?
    ORDER BY tickets.created_at DESC
    LIMIT 1
  `,
    [conversationId]
  )

  const ticket = (rows as TicketRow[])[0] ?? null

  return NextResponse.json({ ticket })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { conversationId } = await context.params
  let payload: TicketUpdatePayload
  try {
    payload = (await request.json()) as TicketUpdatePayload
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const pool = getPool()
  const [ticketRows] = await pool.query(
    `
    SELECT id
    FROM tickets
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [conversationId]
  )

  const ticket = (ticketRows as Array<{ id: string }>)[0]
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 })
  }

  const updates: string[] = []
  const values: Array<string | number | null> = []

  if ("customerName" in payload) {
    updates.push("customer_name = ?")
    values.push(normalizeString(payload.customerName))
  }
  if ("customerPhone" in payload) {
    updates.push("customer_phone = ?")
    values.push(normalizeString(payload.customerPhone))
  }
  if ("franchiseName" in payload) {
    updates.push("franchise_name = ?")
    values.push(normalizeString(payload.franchiseName))
  }
  if ("outletName" in payload) {
    updates.push("outlet_name = ?")
    values.push(normalizeString(payload.outletName))
  }
  if ("fid" in payload) {
    updates.push("fid = ?")
    values.push(normalizeString(payload.fid))
  }
  if ("oid" in payload) {
    updates.push("oid = ?")
    values.push(normalizeString(payload.oid))
  }
  if ("status" in payload) {
    const statusValue = normalizeString(payload.status)
    if (statusValue && !TICKET_STATUSES.has(statusValue)) {
      return NextResponse.json(
        { error: "Invalid ticket status." },
        { status: 400 }
      )
    }
    updates.push("status = ?")
    values.push(statusValue ?? "new")
  }
  if ("category" in payload) {
    updates.push("category = ?")
    values.push(normalizeString(payload.category))
  }
  if ("subcategory1" in payload) {
    updates.push("subcategory_1 = ?")
    values.push(normalizeString(payload.subcategory1))
  }
  if ("subcategory2" in payload) {
    updates.push("subcategory_2 = ?")
    values.push(normalizeString(payload.subcategory2))
  }
  if ("issueDescription" in payload) {
    updates.push("issue_description = ?")
    values.push(normalizeString(payload.issueDescription))
  }
  if ("internalNotes" in payload) {
    updates.push("internal_notes = ?")
    values.push(normalizeString(payload.internalNotes))
  }
  if ("csatLink" in payload) {
    updates.push("csat_link = ?")
    values.push(normalizeString(payload.csatLink))
  }
  if ("csatScore" in payload) {
    const parsedScore = parseCsatScore(payload.csatScore)
    if (parsedScore === undefined) {
      return NextResponse.json(
        { error: "Invalid CSAT score." },
        { status: 400 }
      )
    }
    updates.push("csat_score = ?")
    values.push(parsedScore)
  }
  if ("csatResponse" in payload) {
    updates.push("csat_response = ?")
    values.push(normalizeString(payload.csatResponse))
  }
  if ("msAgentName" in payload) {
    const agentName = normalizeString(payload.msAgentName)
    if (!agentName) {
      updates.push("ms_agent_id = ?")
      values.push(null)
    } else {
      const [agentRows] = await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(name) = LOWER(?)
        LIMIT 1
      `,
        [agentName]
      )
      const agent = (agentRows as Array<{ id: string }>)[0]
      if (!agent) {
        return NextResponse.json(
          { error: "MS agent not found." },
          { status: 400 }
        )
      }
      updates.push("ms_agent_id = ?")
      values.push(agent.id)
    }
  }

  if (!updates.length) {
    return NextResponse.json(
      { error: "No updates provided." },
      { status: 400 }
    )
  }

  values.push(ticket.id)
  await pool.query(
    `
    UPDATE tickets
    SET ${updates.join(", ")}
    WHERE id = ?
  `,
    values
  )

  return NextResponse.json({ ok: true })
}
