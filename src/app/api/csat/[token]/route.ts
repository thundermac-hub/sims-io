import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"

import { hashOpaqueToken } from "@/lib/auth"
import { resolveCsatGoogleReviewUrl } from "@/lib/csat-google-review"
import {
  getCsatTokenColumn,
  getCsatTokenLookupExpression,
  getCsatTokenSelectExpressions,
  getCsatTokenStorageValue,
} from "@/lib/csat-schema"
import getPool from "@/lib/db"
import { tooManyRequests } from "@/lib/api-errors"
import { checkRateLimit, getRateLimitIp } from "@/lib/rate-limit"
import { parseJsonBody } from "@/lib/validation"

import { csatSubmissionSchema } from "./schema"

/**
 * Two rate-limit buckets per endpoint:
 *  - the caller IP, which stops token enumeration across many links, and
 *  - the token itself (hashed and truncated so an attacker-controlled value
 *    never becomes an unbounded Redis key), which stops hammering one link.
 */
async function checkCsatRateLimits(
  request: NextRequest,
  action: "get" | "submit",
  token: string
) {
  const ip = getRateLimitIp(request)
  const tokenBucket = hashOpaqueToken(token).slice(0, 16)
  const [byIp, byToken] = await Promise.all([
    checkRateLimit(`csat:${action}:ip:${ip}`, 30, 300),
    checkRateLimit(`csat:${action}:token:${tokenBucket}`, 10, 300),
  ])
  if (!byIp.allowed) {
    return byIp
  }
  if (!byToken.allowed) {
    return byToken
  }
  return null
}

type TokenRow = RowDataPacket & {
  id: string
  ticket_id: string
  token: string | null
  token_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
  merchant_name: string | null
  franchise_name_resolved: string | null
  outlet_name_resolved: string | null
}

type ResponseRow = RowDataPacket & {
  id: string
  submitted_at: string
  support_score: string | null
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
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const limited = await checkCsatRateLimits(request, "get", token)
  if (limited) {
    return tooManyRequests(limited.retryAfterSeconds)
  }

  const tokenHash = hashOpaqueToken(token)
  const pool = getPool()
  const csatTokenColumn = await getCsatTokenColumn(pool)
  const csatTokenSelectExpressions = getCsatTokenSelectExpressions(
    csatTokenColumn,
    "csat_tokens"
  )
  const csatTokenLookupExpression = getCsatTokenLookupExpression(
    csatTokenColumn,
    "csat_tokens"
  )
  const tokenLookupValue = getCsatTokenStorageValue(csatTokenColumn, token, tokenHash)

  const [tokenRows] = await pool.query<TokenRow[]>(
    `
    SELECT
      csat_tokens.id,
      csat_tokens.ticket_id,
      ${csatTokenSelectExpressions},
      csat_tokens.expires_at,
      csat_tokens.used_at,
      csat_tokens.created_at,
      tickets.merchant_name,
      tickets.franchise_name_resolved,
      tickets.outlet_name_resolved
    FROM csat_tokens
    INNER JOIN tickets
      ON tickets.id = csat_tokens.ticket_id
    WHERE ${csatTokenLookupExpression}
    LIMIT 1
  `,
    [tokenLookupValue]
  )
  const tokenRow = tokenRows[0]
  if (!tokenRow) {
    return NextResponse.json({ error: "CSAT link not found." }, { status: 404 })
  }

  const [responseRows] = await pool.query<ResponseRow[]>(
    `
    SELECT id, submitted_at, support_score
    FROM csat_responses
    WHERE token_id = ?
    LIMIT 1
  `,
    [tokenRow.id]
  )
  const latestResponse = responseRows[0] ?? null
  const status = getTokenStatus(tokenRow, latestResponse)

  const googleReviewUrl = latestResponse
    ? resolveCsatGoogleReviewUrl(latestResponse.support_score ?? "")
    : null

  // Ticket details are only returned while the link is active; expired or
  // already-submitted tokens get status information without any PII. The
  // phone number is never returned — the form does not render it.
  const ticket =
    status === "active"
      ? {
          id: tokenRow.ticket_id,
          merchantName: tokenRow.merchant_name,
          franchiseName: tokenRow.franchise_name_resolved,
          outletName: tokenRow.outlet_name_resolved,
        }
      : null

  return NextResponse.json({
    status,
    ticket,
    token: {
      createdAt: tokenRow.created_at,
      expiresAt: tokenRow.expires_at,
      usedAt: tokenRow.used_at,
      submittedAt: latestResponse?.submitted_at ?? null,
    },
    googleReview: { url: googleReviewUrl },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const limited = await checkCsatRateLimits(request, "submit", token)
  if (limited) {
    return tooManyRequests(limited.retryAfterSeconds)
  }

  const tokenHash = hashOpaqueToken(token)
  const body = await parseJsonBody(request, csatSubmissionSchema)
  if (!body.ok) {
    return body.response
  }
  const { supportScore, supportReason, productScore, productFeedback } = body.data

  const pool = getPool()
  const csatTokenColumn = await getCsatTokenColumn(pool)
  const csatTokenSelectExpressions = getCsatTokenSelectExpressions(csatTokenColumn)
  const csatTokenLookupExpression = getCsatTokenLookupExpression(csatTokenColumn)
  const tokenLookupValue = getCsatTokenStorageValue(csatTokenColumn, token, tokenHash)
  const [tokenRows] = await pool.query<TokenRow[]>(
    `
    SELECT id, ticket_id, ${csatTokenSelectExpressions}, expires_at, used_at, created_at
    FROM csat_tokens
    WHERE ${csatTokenLookupExpression}
    LIMIT 1
  `,
    [tokenLookupValue]
  )
  const tokenRow = tokenRows[0]
  if (!tokenRow) {
    return NextResponse.json({ error: "CSAT link not found." }, { status: 404 })
  }

  const [responseRows] = await pool.query<ResponseRow[]>(
    `
    SELECT id, submitted_at, support_score
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

  // Decision based on the Support Service rating only — show the public Google
  // Review link for Satisfied/Very Satisfied responses when a URL is configured.
  const googleReviewUrl = resolveCsatGoogleReviewUrl(supportScore)

  await pool.query(
    `
    INSERT INTO csat_responses (
      ticket_id,
      token_id,
      support_score,
      support_reason,
      product_score,
      product_feedback,
      google_review_shown_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ${googleReviewUrl ? "NOW(3)" : "NULL"})
  `,
    [
      tokenRow.ticket_id,
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

  return NextResponse.json({ ok: true, googleReview: { url: googleReviewUrl } })
}
