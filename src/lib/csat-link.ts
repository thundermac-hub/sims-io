/**
 * Issue, format and deliver the CSAT survey link for a ticket.
 *
 * Extracted from `src/app/api/tickets/[ticketId]/csat/share/route.ts` so the manual
 * share button and the automatic send on ticket close mint tokens the same way. The
 * two callers differ only in how they deliver the link and what they record
 * afterwards, never in the token's shape or lifetime.
 *
 * `sendCsatLinkForClosedTicket` at the bottom is the automatic path: it is the only
 * database-touching part of the Respond.io CSAT send, and delegates every decision to
 * the import-free `respondio-csat.ts`.
 *
 * Token storage is schema-tolerant: `csat-schema.ts` resolves whether the live
 * database holds `token_hash` or the legacy plaintext `token` column, and whether the
 * FK is `ticket_id` or the legacy `request_id`.
 */

import { randomUUID } from "node:crypto"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

import { hashOpaqueToken, resolveAppBaseUrl } from "@/lib/auth"
import {
  getCsatReferenceColumn,
  getCsatTokenColumn,
  getCsatTokenSelectExpressions,
  getCsatTokenStorageValue,
} from "@/lib/csat-schema"
import type getPool from "@/lib/db"
import {
  CSAT_SEND_FAILED_HISTORY_FIELD,
  CSAT_SHARED_HISTORY_FIELD,
  dispatchCsatLink,
  isCsatAutoSendConfigured,
  resolveCsatAutoSendDecision,
} from "@/lib/respondio-csat"
import type { CsatDispatchResult } from "@/lib/respondio-csat"

/** Days a freshly minted survey token stays valid. Matches the manual share flow. */
const TOKEN_TTL_DAYS = 3

type Pool = ReturnType<typeof getPool>

type CsatTokenRow = RowDataPacket & {
  id: string
  token: string | null
  token_hash: string
  expires_at: string
  used_at: string | null
}

type InsertedTokenRow = RowDataPacket & {
  expires_at: string
}

export type IssuedCsatLink = {
  token: string
  expiresAt: string
  /** True when a new token was minted, false when an unused live token was reused. */
  generated: boolean
}

/**
 * Return the ticket's usable survey token, minting a new one when needed.
 *
 * A token is reused only while it is still readable (plaintext column), unused and
 * unexpired — otherwise every share would hand out a link that resolves to nothing.
 * On the hashed-column schema `token` reads back as NULL, so a fresh token is always
 * minted; that is intended, since the raw value is unrecoverable by design.
 *
 * Superseded tokens are stamped `used_at` before the new row is inserted, so an older
 * link cannot keep collecting responses alongside the current one.
 *
 * Returns null when the token could not be issued; the caller decides how loudly to
 * fail. Writes no `ticket_history` — the caller owns that, because "generated" and
 * "shared" are separate events with different actors.
 */
export async function issueCsatLink(
  pool: Pool,
  ticketId: string
): Promise<IssuedCsatLink | null> {
  const [ticketColumn, tokenColumn] = await Promise.all([
    getCsatReferenceColumn(pool, "csat_tokens"),
    getCsatTokenColumn(pool),
  ])
  const selectExpressions = getCsatTokenSelectExpressions(tokenColumn)

  const [tokenRows] = await pool.query<CsatTokenRow[]>(
    `
    SELECT id, ${selectExpressions}, expires_at, used_at
    FROM csat_tokens
    WHERE ${ticketColumn} = ?
    ORDER BY id DESC
    LIMIT 1
  `,
    [ticketId]
  )

  const existing = tokenRows[0] ?? null
  const existingExpiry = existing ? new Date(existing.expires_at) : null
  const reusable =
    Boolean(existing?.token) &&
    !existing?.used_at &&
    existingExpiry !== null &&
    !Number.isNaN(existingExpiry.valueOf()) &&
    existingExpiry.getTime() >= Date.now()

  if (reusable && existing?.token) {
    return { token: existing.token, expiresAt: existing.expires_at, generated: false }
  }

  await pool.query(
    `
    UPDATE csat_tokens
    SET used_at = COALESCE(used_at, NOW(3))
    WHERE ${ticketColumn} = ?
      AND used_at IS NULL
  `,
    [ticketId]
  )

  const rawToken = randomUUID()
  const tokenValue = getCsatTokenStorageValue(
    tokenColumn,
    rawToken,
    hashOpaqueToken(rawToken)
  )

  const [insertResult] = await pool.query<ResultSetHeader>(
    `
    INSERT INTO csat_tokens (${ticketColumn}, ${tokenColumn}, expires_at)
    VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL ${TOKEN_TTL_DAYS} DAY))
  `,
    [ticketId, tokenValue]
  )

  const [insertedRows] = await pool.query<InsertedTokenRow[]>(
    `
    SELECT expires_at
    FROM csat_tokens
    WHERE id = ?
    LIMIT 1
  `,
    [insertResult.insertId]
  )

  const expiresAt = insertedRows[0]?.expires_at ?? null
  if (!expiresAt) {
    return null
  }

  return { token: rawToken, expiresAt, generated: true }
}

/**
 * Absolute URL for the public survey page.
 *
 * Server-side callers cannot read `window.location.origin` the way the tickets page
 * does, so the link is built from `APP_BASE_URL`. A wrong value here sends merchants
 * a dead link, so it is the one env var this feature genuinely requires.
 */
export function buildCsatUrl(token: string): string {
  return `${resolveAppBaseUrl().replace(/\/+$/, "")}/csat/${encodeURIComponent(token)}`
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Mint the survey link and push it to Respond.io for a ticket that just closed.
 *
 * Called from the ticket PATCH route on the transition into a closed status, after
 * the ticket row and its history have been written. Records what happened in
 * `ticket_history` so the audit trail shows it and the ticket page's CSAT status flips
 * to "Send" on the next read -- the same `csat_link_shared` row the manual button
 * writes, which is also what stops a later close from sending twice.
 *
 * Returns the outcome for the response body; never throws.
 */
export async function sendCsatLinkForClosedTicket(
  pool: Pool,
  params: {
    ticketId: string
    respondioContactId: string | null
    phone: string | null
    merchantName: string | null
    actorId: string
  }
): Promise<CsatDispatchResult> {
  const alreadyShared = await hasSharedCsatLink(pool, params.ticketId)
  const decision = resolveCsatAutoSendDecision({
    respondioContactId: params.respondioContactId,
    alreadyShared,
    configured: isCsatAutoSendConfigured(),
  })

  if (!decision.send) {
    return { status: "skipped", reason: decision.reason }
  }

  const link = await issueCsatLink(pool, params.ticketId)
  if (!link) {
    return { status: "failed", error: "Unable to issue a CSAT token." }
  }

  if (link.generated) {
    await recordHistory(
      pool,
      params.ticketId,
      "csat_token_generated",
      "[generated]",
      params.actorId
    )
  }

  const result = await dispatchCsatLink({
    ticketId: params.ticketId,
    // Non-null by the decision above; narrowed here for the type checker.
    respondioContactId: String(params.respondioContactId),
    phone: params.phone,
    merchantName: params.merchantName,
    csatUrl: buildCsatUrl(link.token),
    expiresAt: link.expiresAt,
  })

  if (result.status === "sent") {
    // `NOW(3)` rather than a JS timestamp, so the row is byte-identical to the one the
    // manual share button writes and the audit trail renders them the same way.
    await recordHistory(
      pool,
      params.ticketId,
      CSAT_SHARED_HISTORY_FIELD,
      "NOW(3)",
      params.actorId
    )
  } else if (result.status === "failed") {
    // Logged rather than swallowed: an agent seeing "Not Sent" on a closed ticket needs
    // to know the automation tried, so they fall back to the manual share button.
    await recordHistory(
      pool,
      params.ticketId,
      CSAT_SEND_FAILED_HISTORY_FIELD,
      result.error.slice(0, 500),
      params.actorId
    )
  }

  return result
}

/**
 * True when the survey link already went out for this ticket, by either path.
 *
 * Reads the same history fields the ticket page uses to show "Send", including the two
 * legacy field names older rows carry, so a link shared before this feature existed
 * still suppresses the automatic send.
 */
async function hasSharedCsatLink(pool: Pool, ticketId: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT 1
    FROM ticket_history
    WHERE ticket_id = ?
      AND field_name IN ('csat_link_shared', 'csat_link_shared_at', 'csat_whatsapp_sent')
    LIMIT 1
  `,
    [ticketId]
  )
  return rows.length > 0
}

/**
 * Append one audit row. `newValue` of the literal string `NOW(3)` is written as the SQL
 * function rather than as text, matching the manual share route's timestamp format.
 */
async function recordHistory(
  pool: Pool,
  ticketId: string,
  field: string,
  newValue: string,
  actorId: string
): Promise<void> {
  const isTimestamp = newValue === "NOW(3)"
  await pool
    .query(
      `
      INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
      VALUES (?, ?, NULL, ${isTimestamp ? "NOW(3)" : "?"}, ?)
    `,
      isTimestamp
        ? [ticketId, field, actorId]
        : [ticketId, field, newValue, actorId]
    )
    .catch((error) => {
      // Bookkeeping must not mask the send's own outcome.
      console.error(`Failed to record ${field} on ticket ${ticketId}`, error)
    })
}
