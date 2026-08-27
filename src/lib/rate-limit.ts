import {
  incrementRateLimitKey,
  RateLimitStoreUnavailableError,
} from "./rate-limit-store.ts"

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/** Retry-After to advertise when the store itself is down (fail closed). */
const STORE_UNAVAILABLE_RETRY_SECONDS = 30

/**
 * Check whether `key` is within the allowed request budget.
 *
 * When the backing store is unreachable in production this fails CLOSED —
 * the request is rejected with a Retry-After, never allowed through and
 * never surfaced as a 500.
 *
 * @param key            Stable identifier (e.g. "login:192.168.1.1")
 * @param maxRequests    Maximum hits permitted inside the window
 * @param windowSeconds  Rolling window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  let count: number
  let retryAfterSeconds: number
  try {
    ;({ count, retryAfterSeconds } = await incrementRateLimitKey(
      key,
      windowSeconds
    ))
  } catch (error) {
    if (error instanceof RateLimitStoreUnavailableError) {
      console.error("[rate-limit] Store unavailable; failing closed:", error.cause)
      return { allowed: false, retryAfterSeconds: STORE_UNAVAILABLE_RETRY_SECONDS }
    }
    throw error
  }

  if (count > maxRequests) {
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true }
}

/**
 * Derive the client IP to use as the rate-limit key.
 *
 * Reads `x-forwarded-for` ONLY when the `TRUSTED_PROXY` environment variable
 * is set (non-empty after trimming). Otherwise returns the literal string
 * `"direct"` to prevent header-spoofing attacks.
 *
 * NOTE: behind a proxy without TRUSTED_PROXY set, every client shares the
 * single "direct" bucket — which is why `assertRateLimitConfig` refuses to
 * boot production without it.
 */
export function getRateLimitIp(request: Request): string {
  if (process.env.TRUSTED_PROXY?.trim()) {
    const forwarded = request.headers.get("x-forwarded-for")
    if (forwarded) {
      // x-forwarded-for may be a comma-separated list; the leftmost entry is
      // the originating client as seen by the first trusted proxy.
      const firstIp = forwarded.split(",")[0].trim()
      if (firstIp) {
        return firstIp
      }
    }
  }

  return "direct"
}

/**
 * Boot-time configuration assertion, called from `src/instrumentation.ts`.
 *
 * In production, a missing TRUSTED_PROXY silently collapses every client
 * into one shared rate-limit bucket (login becomes 10 requests / 15 min
 * globally), and a missing REDIS_URL makes limits per-process. Refuse to
 * boot rather than run with either misconfiguration.
 */
export function assertRateLimitConfig(): void {
  if (process.env.NODE_ENV !== "production") {
    return
  }

  const missing: string[] = []
  if (!process.env.TRUSTED_PROXY?.trim()) {
    missing.push("TRUSTED_PROXY")
  }
  if (!process.env.REDIS_URL?.trim()) {
    missing.push("REDIS_URL")
  }

  if (missing.length > 0) {
    throw new Error(
      `[rate-limit] Refusing to start in production without ${missing.join(
        " and "
      )}. TRUSTED_PROXY makes x-forwarded-for trustworthy so rate limits ` +
        "are per-client instead of one global bucket; REDIS_URL makes them " +
        "consistent across processes. Set both in the deployment environment."
    )
  }
}
