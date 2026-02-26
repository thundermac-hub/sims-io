"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/merchant-success/analytics", label: "Overview" },
  { href: "/merchant-success/analytics/tickets", label: "Tickets" },
  { href: "/merchant-success/analytics/issue", label: "Issue" },
  { href: "/merchant-success/analytics/merchant-frequency", label: "Merchant" },
  { href: "/merchant-success/analytics/ms", label: "MS" },
]

export function MerchantSuccessAnalyticsSubnav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const active = pathname === item.href
        return (
          <Button key={item.href} asChild size="sm" variant={active ? "default" : "outline"}>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        )
      })}
    </div>
  )
}
