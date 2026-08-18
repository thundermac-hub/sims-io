import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import { generateSharedSecret, maskSecret } from "@/lib/respondio-secrets"
import { resolveIntegrationsUser } from "../helpers"
import type { RowDataPacket } from "mysql2/promise"

export const runtime = "nodejs"

/**
 * At most two keys may be active at once.
 *
 * Rotation is not a swap: n8n has to be updated by hand, so the previous key keeps
 * verifying as a grace window. Capping at two bounds how long a compromised key can
 * linger and stops the active set growing every time someone clicks Rotate.
 */
const MAX_ACTIVE_SECRETS = 2

/**
 * POST /api/integrations/respond-io/secret — issue a new shared secret.
 *
 * The raw value is returned in THIS response and nowhere else, ever. Only its sha256
 * is stored, so there is no reveal action and no way to recover it later — the UI must
 * make that clear and the client must hold it long enough for the user to copy it.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveIntegrationsUser(request, true)
  if ("response" in auth) {
    return auth.response
  }

  const generated = generateSharedSecret()

  try {
    await queryWithReconnect(
      `INSERT INTO respondio_integration_secrets
         (key_id, secret_hash, secret_prefix, secret_last4, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        generated.keyId,
        generated.secretHash,
        generated.secretPrefix,
        generated.secretLast4,
        auth.user.id,
      ]
    )

    // Revoke the oldest keys beyond the cap, newest-first ordering preserved so the
    // key just issued and the one before it survive.
    const [active] = await queryWithReconnect<
      Array<RowDataPacket & { id: number | string }>
    >(
      `SELECT id FROM respondio_integration_secrets
       WHERE revoked_at IS NULL
       ORDER BY created_at DESC, id DESC`
    )

    const stale = active.slice(MAX_ACTIVE_SECRETS)
    if (stale.length) {
      const placeholders = stale.map(() => "?").join(", ")
      await queryWithReconnect(
        `UPDATE respondio_integration_secrets
         SET revoked_at = CURRENT_TIMESTAMP(3), revoked_by_user_id = ?
         WHERE id IN (${placeholders})`,
        [auth.user.id, ...stale.map((row) => row.id)]
      )
    }

    return NextResponse.json(
      {
        // Shown once. Never logged.
        secret: generated.raw,
        keyId: generated.keyId,
        masked: maskSecret(generated.secretPrefix, generated.secretLast4),
        revokedCount: stale.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to issue Respond.io shared secret", error)
    return NextResponse.json(
      { error: "Unable to issue a new secret." },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/respond-io/secret?keyId=... — revoke one key.
 *
 * Revoking the last active key deliberately still succeeds: an operator who believes a
 * secret is compromised must be able to shut the endpoint off immediately, even at the
 * cost of dropping inbound events until a new key is issued.
 */
export async function DELETE(request: NextRequest) {
  const auth = await resolveIntegrationsUser(request, true)
  if ("response" in auth) {
    return auth.response
  }

  const keyId = new URL(request.url).searchParams.get("keyId")?.trim()
  if (!keyId) {
    return NextResponse.json({ error: "A key id is required." }, { status: 400 })
  }

  const [result] = await queryWithReconnect(
    `UPDATE respondio_integration_secrets
     SET revoked_at = CURRENT_TIMESTAMP(3), revoked_by_user_id = ?
     WHERE key_id = ? AND revoked_at IS NULL`,
    [auth.user.id, keyId]
  )

  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  if (!affected) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 })
  }

  return NextResponse.json({ revoked: true })
}
