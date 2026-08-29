import { serverError } from "@/lib/api-errors"

import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { isCronSecretAuthorized } from "@/lib/cron-auth"
import { resolveActorLabel, syncAllClickUpTicketStatuses } from "@/lib/clickup-ticket-sync"
import { withRequestContext } from "@/lib/api-request-context"

/**
 * Wrapped so every log line this sync produces — including the per-ticket
 * failures inside syncAllClickUpTicketStatuses — carries one request id, and
 * so a failure response quotes an id the operator can grep for.
 */
export const POST = withRequestContext("/api/clickup/sync", handlePost)

async function handlePost(request: NextRequest): Promise<Response> {
  const cronAllowed = isCronSecretAuthorized(request, process.env.CLICKUP_SYNC_CRON_SECRET)

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
