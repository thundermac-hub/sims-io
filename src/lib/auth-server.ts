import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  getUserBySessionToken,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth"
import {
  canAccessAnyPath,
  GENERAL_OVERVIEW_PATH,
} from "@/lib/page-access"

/**
 * Server Component session helpers — the Data Access Layer guard.
 *
 * These are the server-render counterparts to `requireAuthenticatedUser`
 * (which takes a `NextRequest` and therefore only works in route handlers).
 * They live in their own module because `next/headers` cannot be imported
 * from the Edge middleware runtime, and `auth.ts` exports constants the
 * middleware may need.
 *
 * IMPORTANT — placement rule for callers: `requirePageAccess` /
 * `requireServerSession` must be the FIRST statement of the exported
 * function, before any `try`. `redirect()` works by throwing; a surrounding
 * `catch` silently swallows it and renders an empty page instead of
 * denying access.
 */

/**
 * Resolve the active session user for the current server render.
 *
 * Wrapped in React `cache()` so the layout guard and every guarded data
 * module in the same render share one `sessions` + `users` JOIN.
 */
export const getServerSessionUser = cache(
  async (): Promise<SessionUser | null> => {
    const cookieStore = await cookies()
    const user = await getUserBySessionToken(
      cookieStore.get(SESSION_COOKIE_NAME)?.value
    )
    if (!user || user.status !== "active") {
      return null
    }
    // Return a plain SessionUser — never the full AuthenticatedUser, whose
    // extra fields (passwordHash, googleSubject) must not leak into props
    // that get serialized to client components.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      pageAccess: user.pageAccess,
    }
  }
)

/** Authentication only — for the (app) layout. */
export async function requireServerSession(): Promise<SessionUser> {
  const user = await getServerSessionUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

/**
 * Authentication + page-access authorization for server-rendered data.
 *
 * `paths` is OR-ed: access to any one of the given route paths is enough.
 * Redirects to `/login` when unauthenticated and to the general overview
 * when the user lacks every listed access key.
 */
export async function requirePageAccess(
  paths: string | readonly string[]
): Promise<SessionUser> {
  const user = await getServerSessionUser()
  if (!user) {
    redirect("/login")
  }

  const pathList = typeof paths === "string" ? [paths] : paths
  if (!canAccessAnyPath(user.role, user.pageAccess, pathList)) {
    redirect(GENERAL_OVERVIEW_PATH)
  }

  return user
}
