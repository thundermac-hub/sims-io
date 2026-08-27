"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  clearSession,
  getSessionState,
  setSessionUser,
  type SessionUser,
} from "@/lib/session"
import { canAccessPath } from "@/lib/page-access"

/**
 * Client-side navigation gate.
 *
 * This is a UX layer for client navigations, NOT the security boundary:
 * authentication happens server-side in the (app) layout
 * (`requireServerSession`, which redirects before this ever renders) and
 * authorization in each page's data layer (`requirePageAccess`). This
 * component gives instant client-side redirects for pages the user's keys
 * don't cover, keeps the cached session user in sync, and revalidates the
 * session in the background on navigation so a mid-session revocation is
 * picked up promptly (layouts don't re-render on soft navigations).
 */
export function AppAuthGate({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: SessionUser
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = React.useState(initialUser)

  const allowed = canAccessPath(user.role, user.pageAccess ?? [], pathname)

  React.useEffect(() => {
    setSessionUser(initialUser, getSessionState()?.remember ?? false)
  }, [initialUser])

  React.useEffect(() => {
    if (!allowed) {
      router.replace("/overview")
    }
  }, [allowed, router])

  // Background revalidation per navigation — never blocks rendering, so
  // there is no "Checking session..." flash; a revoked session redirects
  // to login on the next client-side navigation instead of persisting
  // until a hard reload.
  React.useEffect(() => {
    let cancelled = false

    const revalidate = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin",
        })
        if (cancelled) {
          return
        }
        if (!response.ok) {
          clearSession()
          router.replace("/login")
          return
        }
        const data = (await response.json()) as { user?: SessionUser }
        if (cancelled) {
          return
        }
        if (!data.user) {
          clearSession()
          router.replace("/login")
          return
        }
        setSessionUser(data.user, getSessionState()?.remember ?? false)
        setUser(data.user)
      } catch {
        // Network hiccup: keep the current render; the server guards still
        // protect every data read.
      }
    }

    void revalidate()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
