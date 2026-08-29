/**
 * Next.js instrumentation hook — runs once at server boot.
 *
 * Refuses to start a misconfigured production instance rather than running
 * with silently broken rate limiting, and wires error reporting when — and
 * only when — a DSN is configured.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  const { assertRateLimitConfig } = await import("@/lib/rate-limit")
  assertRateLimitConfig()

  // Dynamic import behind the DSN check: with no DSN this never executes, so
  // the SDK is never loaded and nothing is instrumented.
  if (process.env.SENTRY_DSN?.trim()) {
    await import("../sentry.server.config")
  }
}

/**
 * Next calls this for every server-side error. Returns immediately without a
 * DSN so an installation with no Sentry account pays nothing per request.
 */
export async function onRequestError(
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
): Promise<void> {
  if (!process.env.SENTRY_DSN?.trim()) {
    return
  }
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureRequestError(...args)
}
