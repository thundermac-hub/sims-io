import { timingSafeEqual } from "crypto"

/**
 * Constant-time check of the `x-cron-secret` header against a configured
 * secret. One shared implementation so the timing-safe comparison cannot
 * drift between the cron-triggered routes.
 */
export function isCronSecretAuthorized(
  request: Request,
  configuredSecret: string | undefined
): boolean {
  const cronSecret = configuredSecret?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim()
  if (!cronSecret || !providedSecret) {
    return false
  }
  const expected = Buffer.from(cronSecret)
  const provided = Buffer.from(providedSecret)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}
