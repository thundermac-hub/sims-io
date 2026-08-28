import type { NextRequest, NextResponse } from "next/server"

import {
  evaluateApiAccess,
  type ApiAuthOptions,
  type ApiAuthUser,
} from "@/lib/api-access"
import { forbidden, unauthorized } from "@/lib/api-errors"
import { requireAuthenticatedUser } from "@/lib/auth"

/**
 * One API authorization helper.
 *
 * All the per-module `resolve*User` helpers are one-line wrappers around
 * `resolveApiUser`, so status codes and error strings stay identical
 * everywhere ("Unauthorized."/401, "Forbidden."/403) and the Super Admin
 * bypass lives in exactly one place. The pure decision logic lives in
 * api-access.ts, where it is unit-testable without next/server.
 */

export {
  evaluateApiAccess,
  type ApiAccessDecision,
  type ApiAuthOptions,
  type ApiAuthUser,
} from "@/lib/api-access"

/**
 * Authenticate the request and apply the given authorization options.
 * Returns the `{ user } | { response }` union every route already consumes
 * via the `"response" in auth` idiom.
 */
export async function resolveApiUser(
  request: NextRequest,
  options: ApiAuthOptions = {}
): Promise<{ user: ApiAuthUser } | { response: NextResponse }> {
  const user = await requireAuthenticatedUser(request)
  if (!user) {
    return { response: unauthorized() }
  }

  const authUser: ApiAuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    pageAccess: user.pageAccess,
  }

  const decision = evaluateApiAccess(authUser, options)
  if (!decision.allowed) {
    return { response: forbidden(decision.message) }
  }

  return { user: authUser }
}
