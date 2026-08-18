import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import { maskSecret } from "@/lib/respondio-secrets"
import { loadRespondioSettings, saveRespondioSettings } from "@/lib/respondio"
import { canManageSecrets, resolveIntegrationsUser } from "../helpers"
import type { RowDataPacket } from "mysql2/promise"

export const runtime = "nodejs"

type ActiveSecretRow = RowDataPacket & {
  key_id: string
  secret_prefix: string
  secret_last4: string
  created_at: string
  last_used_at: string | null
  created_by_name: string | null
}

/**
 * GET — the routing tag plus the *masked* form of every active key.
 *
 * The raw secret is never returned here; it exists in a response body exactly once,
 * when it is issued by `POST .../secret`. See `src/lib/respondio-secrets.ts`.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveIntegrationsUser(request, false)
  if ("response" in auth) {
    return auth.response
  }

  const settings = await loadRespondioSettings()

  const [rows] = await queryWithReconnect<ActiveSecretRow[]>(
    `SELECT
       s.key_id, s.secret_prefix, s.secret_last4, s.created_at, s.last_used_at,
       u.name AS created_by_name
     FROM respondio_integration_secrets AS s
     LEFT JOIN users AS u ON u.id = s.created_by_user_id
     WHERE s.revoked_at IS NULL
     ORDER BY s.created_at DESC`
  )

  return NextResponse.json({
    settings,
    canManageSecrets: canManageSecrets(auth.user.role),
    secrets: rows.map((row) => ({
      keyId: row.key_id,
      masked: maskSecret(row.secret_prefix, row.secret_last4),
      createdAt: row.created_at,
      createdBy: row.created_by_name,
      lastUsedAt: row.last_used_at,
    })),
    endpoint: "POST /api/integrations/respond-io",
    secretHeader: "x-sims-webhook-secret",
  })
}

/** PUT — update the Merchant Success routing tag. */
export async function PUT(request: NextRequest) {
  const auth = await resolveIntegrationsUser(request, true)
  if ("response" in auth) {
    return auth.response
  }

  const body = (await request.json().catch(() => null)) as {
    routingTag?: unknown
  } | null

  const routingTag =
    typeof body?.routingTag === "string" ? body.routingTag.trim() : ""

  if (!routingTag) {
    return NextResponse.json(
      { error: "A routing tag is required." },
      { status: 400 }
    )
  }
  if (routingTag.length > 120) {
    return NextResponse.json(
      { error: "Routing tag must be 120 characters or fewer." },
      { status: 400 }
    )
  }

  await saveRespondioSettings(routingTag, auth.user.email)

  return NextResponse.json({ settings: await loadRespondioSettings() })
}
