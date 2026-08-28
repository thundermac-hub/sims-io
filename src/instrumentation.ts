/**
 * Next.js instrumentation hook — runs once at server boot.
 * Refuses to start a misconfigured production instance instead of running
 * with silently broken rate limiting.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRateLimitConfig } = await import("@/lib/rate-limit")
    assertRateLimitConfig()
  }
}
