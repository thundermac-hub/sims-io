import { NextRequest, NextResponse } from "next/server"

import { resolveActorLabel, syncAllClickUpTicketStatuses } from "@/lib/clickup-ticket-sync"

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.CLICKUP_SYNC_CRON_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim()
  return Boolean(cronSecret && providedSecret && providedSecret === cronSecret)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()

  if (!userId && !isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const actorLabel = userId ? await resolveActorLabel(userId) : "ClickUp Cron Sync"

  try {
    const result = await syncAllClickUpTicketStatuses({ actorLabel })
    return NextResponse.json({ result })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run ClickUp status sync.",
      },
      { status: 500 }
    )
  }
}
