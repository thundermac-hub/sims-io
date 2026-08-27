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
 * (`requireServerSession`) and authorization in each page's data layer
 * (`requirePageAccess`). When the layout passes the server-resolved
 * `initialUser`, the gate validates paths locally with no session fetch
 * and no "Checking session..." flash.
 */
export function AppAuthGate({
  children,
  initialUser = null,
}: {
  children: React.ReactNode
  initialUser?: SessionUser | null
}) {
  const router = useRouter()
  const pathname = usePathname()

  const initiallyAllowed = initialUser
    ? canAccessPath(initialUser.role, initialUser.pageAccess ?? [], pathname)
    : false
  const [checking, setChecking] = React.useState(!initiallyAllowed)
  const [hasSession, setHasSession] = React.useState(initiallyAllowed)
  const [verifiedPath, setVerifiedPath] = React.useState<string | null>(
    initiallyAllowed ? pathname : null
  )

  React.useEffect(() => {
    let cancelled = false

    const validateUser = (user: SessionUser | null) => {
      if (cancelled) {
        return
      }
      if (!user) {
        setHasSession(false)
        setVerifiedPath(null)
        setChecking(false)
        router.replace("/login")
        return
      }

      if (!canAccessPath(user.role, user.pageAccess ?? [], pathname)) {
        router.replace("/overview")
        return
      }

      setHasSession(true)
      setVerifiedPath(pathname)
      setChecking(false)
    }

    if (initialUser) {
      // The server layout authenticated this render; keep the client-side
      // session cache in sync and check the path key without a round trip.
      setSessionUser(initialUser, getSessionState()?.remember ?? false)
      validateUser(initialUser)
      return () => {
        cancelled = true
      }
    }

    const validateServerSession = async () => {
      setChecking(true)
      setHasSession(false)
      setVerifiedPath(null)

      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin",
        })

        if (!response.ok) {
          clearSession()
          validateUser(null)
          return
        }

        const data = (await response.json()) as { user?: SessionUser }
        if (!data.user) {
          clearSession()
          validateUser(null)
          return
        }

        const remember = getSessionState()?.remember ?? false
        setSessionUser(data.user, remember)
        validateUser(data.user)
      } catch {
        clearSession()
        validateUser(null)
      }
    }

    void validateServerSession()

    return () => {
      cancelled = true
    }
  }, [pathname, router, initialUser])

  if (checking) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Checking session...
      </div>
    )
  }

  if (!hasSession || verifiedPath !== pathname) {
    return null
  }

  return <>{children}</>
}
