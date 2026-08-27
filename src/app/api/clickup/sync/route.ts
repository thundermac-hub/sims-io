import { timingSafeEqual } from "crypto"
import { serverError } from "@/lib/api-errors"

import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { resolveActorLabel, syncAllClickUpTicketStatuses } from "@/lib/clickup-ticket-sync"

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.CLICKUP_SYNC_CRON_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim()
  if (!cronSecret || !providedSecret) {
    return false
  }
  const expected = Buffer.from(cronSecret)
  const provided = Buffer.from(providedSecret)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function POST(request: NextRequest) {
  const cronAllowed = isCronAuthorized(request)

  if (!cronAllowed) {
    // A manual full sync touches every linked ticket, so require the
    // /clickup-tasks key plus the Admin role.
    const auth = await resolveApiUser(request, {
      allowedPaths: ["/clickup-tasks"],
      requireRole: "Admin",
    })
    if ("response" in auth) {
      return auth.response
    }
    const actorLabel = await resolveActorLabel(auth.user.id)
    try {
      const result = await syncAllClickUpTicketStatuses({ actorLabel })
      return NextResponse.json({ result })
    } catch (error) {
      return serverError("clickup/sync", error, "Failed to run ClickUp status sync.")
    }
  }

  const actorLabel = "ClickUp Cron Sync"
  try {
    const result = await syncAllClickUpTicketStatuses({ actorLabel })
    return NextResponse.json({ result })
  } catch (error) {
    return serverError("clickup/sync", error, "Failed to run ClickUp status sync.")
  }
}
