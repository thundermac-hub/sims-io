"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { getSessionUser, setSessionUser } from "@/lib/session"
import { hasPageAccessForPath } from "@/lib/page-access"

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = React.useState(true)
  const [hasSession, setHasSession] = React.useState(false)

  React.useEffect(() => {
    const validateUser = (user: ReturnType<typeof getSessionUser>) => {
      if (!user) {
        setHasSession(false)
        setChecking(false)
        router.replace("/login")
        return
      }
      if (user.role === "Super Admin") {
        setHasSession(true)
        setChecking(false)
        return
      }

      const pageAccess = user.pageAccess ?? []
      const hasAccess = hasPageAccessForPath(pathname, pageAccess)
      if (!hasAccess) {
        router.replace("/overview")
        return
      }

      setHasSession(true)
      setChecking(false)
    }

    const existing = getSessionUser()
    if (existing) {
      if (existing.role !== "Super Admin" && !existing.pageAccess) {
        const hydrate = async () => {
          try {
            const response = await fetch("/api/auth/session")
            const data = (await response.json()) as { user?: Parameters<typeof setSessionUser>[0] }
            if (response.ok && data.user) {
              setSessionUser(data.user, false)
              validateUser(data.user)
              return
            }
            validateUser(existing)
          } catch {
            validateUser(existing)
          }
        }
        void hydrate()
        return
      }
      validateUser(existing)
      return
    }

    const hydrateFromCookie = async () => {
      try {
        const response = await fetch("/api/auth/session")
        const data = (await response.json()) as { user?: Parameters<typeof setSessionUser>[0] }
        if (!response.ok || !data.user) {
          validateUser(null)
          return
        }
        setSessionUser(data.user, false)
        validateUser(data.user)
      } catch {
        validateUser(null)
      }
    }

    void hydrateFromCookie()
  }, [pathname, router])

  if (checking) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Checking session...
      </div>
    )
  }

  if (!hasSession) {
    return null
  }

  return <>{children}</>
}
