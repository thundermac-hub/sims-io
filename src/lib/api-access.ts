import { canAccessAnyPath, SUPER_ADMIN_ROLE } from "./page-access.ts"

/**
 * Pure API access decisions — no request, no database, no next/server —
 * so the authorization rules are unit-testable under node --test.
 * `resolveApiUser` in api-auth.ts is the request-facing wrapper.
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
