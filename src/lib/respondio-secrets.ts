/**
 * Shared-secret handling for the Respond.io inbound endpoint.
 *
 * Only the sha256 of a secret is stored; the raw value is shown once, at creation.
 * That is already this repo's posture for machine tokens -- `sessions` stores only
 * `hashOpaqueToken(raw)`, and `csat_tokens.token_hash` is documented as "SHA-256 of
 * the raw token".
 *
 * DELIBERATELY NOT scrypt. `hashPassword` in `src/lib/auth.ts` uses scryptSync
 * because human passwords are low-entropy and need a slow KDF to resist offline
 * brute force. This is a 128-bit random token verified on *every* inbound webhook
 * call; scrypt would add roughly 100ms of CPU to each one for no security gain,
 * since there is no dictionary to search. Please do not "harden" this to scrypt.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export const SECRET_PREFIX = "sk_n8n_"

/**
 * Identical to `hashOpaqueToken` in `src/lib/auth.ts`, inlined rather than imported:
 * that module pulls in the database pool and object storage, which would drag both
 * into this file's unit test (`npm test` runs plain `node --test`, no Next.js
 * resolver).
 */
function hashSecret(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export type GeneratedSecret = {
  /** Shown to the user exactly once. Never stored, never logged. */
  raw: string
  keyId: string
  secretHash: string
  secretPrefix: string
  secretLast4: string
}

export function generateSharedSecret(): GeneratedSecret {
  const raw = `${SECRET_PREFIX}${randomBytes(24).toString("base64url")}`

  return {
    raw,
    keyId: randomBytes(6).toString("hex"),
    secretHash: hashSecret(raw),
    secretPrefix: SECRET_PREFIX,
    secretLast4: raw.slice(-4),
  }
}

/**
 * Constant-time comparison of a presented secret against a stored hash.
 *
 * Both sides are fixed-length hex digests, so `timingSafeEqual` never sees mismatched
 * lengths and the comparison leaks nothing about the real secret -- not even its
 * length, which a direct compare of the raw values would.
 */
export function secretsMatch(
  provided: string | null | undefined,
  storedHashHex: string | null | undefined
): boolean {
  if (!provided || !storedHashHex) {
    return false
  }

  // A malformed stored hash can never be a legitimate match; bail before Buffer
  // parsing turns it into a length mismatch we would have to special-case.
  if (!/^[0-9a-f]{64}$/i.test(storedHashHex)) {
    return false
  }

  const providedHash = Buffer.from(hashSecret(provided), "hex")
  const storedHash = Buffer.from(storedHashHex.toLowerCase(), "hex")

  if (providedHash.length !== storedHash.length) {
    return false
  }

  return timingSafeEqual(providedHash, storedHash)
}

/** The settings page's masked display, e.g. `sk_n8n_••••••••••••4f2a`. */
export function maskSecret(prefix: string, last4: string): string {
  return `${prefix}${"•".repeat(12)}${last4}`
}
