import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"

import getPool from "@/lib/db"

type TokenRow = RowDataPacket & {
  id: string
  request_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
  ticket_id: string
  merchant_name: string | null
  phone_number: string | null
  franchise_name_resolved: string | null
  outlet_name_resolved: string | null
}

type ResponseRow = RowDataPacket & {
  id: string
  submitted_at: string
}

function getTokenStatus(token: TokenRow, response: ResponseRow | null) {
  if (response || token.used_at) {
    return "submitted"
  }
  const expiresAt = new Date(token.expires_at)
  if (Number.isNaN(expiresAt.valueOf()) || expiresAt.getTime() < Date.now()) {
    return "expired"
  }
  return "active"
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const pool = getPool()

  const [tokenRows] = await pool.query<TokenRow[]>(
    `
    SELECT
      csat_tokens.id,
      csat_tokens.request_id,
      csat_tokens.token,
      csat_tokens.expires_at,
      csat_tokens.used_at,
      csat_tokens.created_at,
      support_requests.id AS ticket_id,
      support_requests.merchant_name,
      support_requests.phone_number,
      support_requests.franchise_name_resolved,
      support_requests.outlet_name_resolved
    FROM csat_tokens
    INNER JOIN support_requests
      ON support_requests.id = csat_tokens.request_id
    WHERE csat_tokens.token = ?
    LIMIT 1
  `,
    [token]
  )
  const tokenRow = tokenRows[0]
  if (!tokenRow) {
    return NextResponse.json({ error: "CSAT link not found." }, { status: 404 })
  }

  const [responseRows] = await pool.query<ResponseRow[]>(
    `
    SELECT id, submitted_at
    FROM csat_responses
    WHERE token_id = ?
    LIMIT 1
  `,
    [tokenRow.id]
  )
  const latestResponse = responseRows[0] ?? null
  const status = getTokenStatus(tokenRow, latestResponse)

  return NextResponse.json({
    status,
    ticket: {
      id: tokenRow.ticket_id,
      merchantName: tokenRow.merchant_name,
      phoneNumber: tokenRow.phone_number,
      franchiseName: tokenRow.franchise_name_resolved,
      outletName: tokenRow.outlet_name_resolved,
    },
    token: {
      createdAt: tokenRow.created_at,
      expiresAt: tokenRow.expires_at,
      usedAt: tokenRow.used_at,
      submittedAt: latestResponse?.submitted_at ?? null,
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = (await request.json()) as {
    supportScore?: string
    supportReason?: string | null
    productScore?: string
    productFeedback?: string | null
  }

  const supportScore = (body.supportScore ?? "").trim()
  const productScore = (body.productScore ?? "").trim()
  const supportReason = body.supportReason?.trim() ?? null
  const productFeedback = body.productFeedback?.trim() ?? null

  if (!supportScore || !productScore) {
    return NextResponse.json({ error: "Scores are required." }, { status: 400 })
  }

  const pool = getPool()
  const [tokenRows] = await pool.query<TokenRow[]>(
    `
    SELECT id, request_id, token, expires_at, used_at, created_at
    FROM csat_tokens
    WHERE token = ?
    LIMIT 1
  `,
    [token]
  )
  const tokenRow = tokenRows[0]
  if (!tokenRow) {
    return NextResponse.json({ error: "CSAT link not found." }, { status: 404 })
  }

  const [responseRows] = await pool.query<ResponseRow[]>(
    `
    SELECT id, submitted_at
    FROM csat_responses
    WHERE token_id = ?
    LIMIT 1
  `,
    [tokenRow.id]
  )
  const latestResponse = responseRows[0] ?? null
  const status = getTokenStatus(tokenRow, latestResponse)
  if (status !== "active") {
    return NextResponse.json(
      { error: "CSAT link has expired or was already used.", status },
      { status: 400 }
    )
  }

  await pool.query(
    `
    INSERT INTO csat_responses (
      request_id,
      token_id,
      support_score,
      support_reason,
      product_score,
      product_feedback
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      tokenRow.request_id,
      tokenRow.id,
      supportScore,
      supportReason,
      productScore,
      productFeedback,
    ]
  )

  await pool.query(
    `
    UPDATE csat_tokens
    SET used_at = NOW(3)
    WHERE id = ?
  `,
    [tokenRow.id]
  )

  return NextResponse.json({ ok: true })
}
