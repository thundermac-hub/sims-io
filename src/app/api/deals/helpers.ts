import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import type { LeadAuthUser } from "@/lib/leads"

/**
 * Resolves the authenticated user and enforces access to the Deals page.
 * Super Admin bypasses; everyone else needs the `/sales/deals` access key.
 */
export async function resolveDealsUser(
  request: NextRequest
): Promise<{ user: LeadAuthUser } | { response: NextResponse }> {
  return resolveApiUser(request, { allowedPaths: ["/sales/deals"] })
}

export function parseDealId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}
