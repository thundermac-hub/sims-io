import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"

import { requireAuthenticatedUser } from "@/lib/auth"
import { issueCsatLink } from "@/lib/csat-link"
import getPool from "@/lib/db"
import { resolveTicketHistoryActor } from "@/lib/ticket-history-actor"

type TicketRow = RowDataPacket & {
  id: string
  status: string
}

/**
 * POST /api/tickets/:ticketId/csat/share — mint (or reuse) the survey token for a
 * manual share and record that the link went out.
 *
 * The token work itself lives in `src/lib/csat-link.ts`, shared with the automatic
 * send that fires when a ticket is closed, so both paths issue identical links. This
 * route only adds the authorization check, the Resolved-only guard, and the history
 * entries.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const user = await requireAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { ticketId } = await params
  const pool = getPool()
  const [ticketRows] = await pool.query<TicketRow[]>(
    "SELECT id, status FROM tickets WHERE id = ? LIMIT 1",
    [ticketId]
  )
  const ticket = ticketRows[0]
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 })
  }
  if (ticket.status !== "Resolved") {
    return NextResponse.json(
      { error: "CSAT link can only be shared for resolved tickets." },
      { status: 400 }
    )
  }

  const link = await issueCsatLink(pool, ticketId)
  if (!link) {
    return NextResponse.json({ error: "Unable to create CSAT link." }, { status: 500 })
  }

  const actorId = resolveTicketHistoryActor(user)
  if (link.generated) {
    await pool.query(
      `
      INSERT INTO ticket_history (
        ticket_id,
        field_name,
        old_value,
        new_value,
        changed_by
      )
      VALUES (?, 'csat_token_generated', NULL, ?, ?)
    `,
      [ticketId, "[generated]", actorId]
    )
  }

  await pool.query(
    `
    INSERT INTO ticket_history (
      ticket_id,
      field_name,
      old_value,
      new_value,
      changed_by
    )
    VALUES (?, 'csat_link_shared', NULL, NOW(3), ?)
  `,
    [ticketId, actorId]
  )

  return NextResponse.json({
    ok: true,
    token: link.token,
    expiresAt: link.expiresAt,
    generated: link.generated,
  })
}
