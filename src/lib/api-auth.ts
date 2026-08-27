import type { NextRequest, NextResponse } from "next/server"

import { forbidden, unauthorized } from "@/lib/api-errors"
import { requireAuthenticatedUser } from "@/lib/auth"
import { canAccessAnyPath, SUPER_ADMIN_ROLE } from "@/lib/page-access"

/**
 * One API authorization helper.
 *
 * All the per-module `resolve*User` helpers are one-line wrappers around
 * `resolveApiUser`, so status codes and error strings stay identical
 * everywhere ("Unauthorized."/401, "Forbidden."/403) and the Super Admin
 * bypass lives in exactly one place (`canAccessAnyPath`).
 */

export type ApiAuthUser = {
  id: string
  name: string
  email: string
  role: string
  department: string
  pageAccess: string[]
}

export type ApiAuthOptions = {
  /** Route paths (OR-ed) the user needs a page-access key for. */
  allowedPaths?: readonly string[]
  /** Role(s) required in addition to the path check. Super Admin always passes. */
  requireRole?: string | readonly string[]
  /** Custom 403 message for the role check (defaults to "Forbidden."). */
  roleErrorMessage?: string
}

export type ApiAccessDecision =
  | { allowed: true }
  | { allowed: false; message: string }

/**
 * Pure access decision — no request, no database — so authorization rules
 * are unit-testable.
 */
export function evaluateApiAccess(
  user: Pick<ApiAuthUser, "role" | "pageAccess">,
  options: ApiAuthOptions
): ApiAccessDecision {
  const { allowedPaths, requireRole, roleErrorMessage } = options

  if (
    allowedPaths &&
    allowedPaths.length > 0 &&
    !canAccessAnyPath(user.role, user.pageAccess, allowedPaths)
  ) {
    return { allowed: false, message: "Forbidden." }
  }

  if (requireRole !== undefined) {
    const roles =
      typeof requireRole === "string" ? [requireRole] : requireRole
    if (user.role !== SUPER_ADMIN_ROLE && !roles.includes(user.role)) {
      return { allowed: false, message: roleErrorMessage ?? "Forbidden." }
    }
  }

  return { allowed: true }
}

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
