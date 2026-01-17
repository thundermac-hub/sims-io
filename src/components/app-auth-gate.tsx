"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { getSessionUser } from "@/lib/session"

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = React.useState(true)
  const [hasSession, setHasSession] = React.useState(false)

  React.useEffect(() => {
    const user = getSessionUser()
    if (!user) {
      setHasSession(false)
      setChecking(false)
      router.replace("/login")
      return
    }
    if (user) {
      const departmentMap: Record<string, string> = {
        "Merchant Success": "/merchant-success",
        "Sales & Marketing": "/sales",
        "Renewal & Retention": "/renewal-retention",
        "Product & Engineering": "/merchants",
        "General Operation": "/merchants",
      }
      const departmentPrefix = Object.keys(departmentMap).find((key) =>
        pathname.startsWith(departmentMap[key])
      )
      const defaultRoute = departmentMap[user.department] ?? "/merchants"

      if (user.role === "User" && pathname.startsWith("/user-management")) {
        router.replace(defaultRoute)
        return
      }

      if (
        user.role !== "Super Admin" &&
        departmentPrefix &&
        departmentPrefix !== user.department
      ) {
        router.replace(defaultRoute)
        return
      }
    }

    setHasSession(true)
    setChecking(false)
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
