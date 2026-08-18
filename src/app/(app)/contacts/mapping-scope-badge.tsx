import { cn } from "@/lib/utils"

/**
 * "Franchise-wide" vs outlet-scoped pill.
 *
 * Built on the same base class string as `sales/leads/lead-status-badge.tsx` — the UI
 * kit has no `badge.tsx`, and every module rolls its own on that shared base. The hue
 * utilities are the `bg-<hue>-500/10 text-<hue>-600 dark:text-<hue>-400` idiom rather
 * than raw hex, so the pill flips correctly in dark mode.
 */
const BASE =
  "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"

const TONES = {
  franchise: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  outlet: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
} as const

export type MappingScopeTone = keyof typeof TONES

export function MappingScopeBadge({
  children,
  tone,
  className,
}: {
  children: React.ReactNode
  tone: MappingScopeTone
  className?: string
}) {
  return <span className={cn(BASE, TONES[tone], className)}>{children}</span>
}

/** Convenience wrapper for a single mapping row. */
export function MappingBadge({
  franchiseWide,
  className,
}: {
  franchiseWide: boolean
  className?: string
}) {
  return (
    <MappingScopeBadge
      tone={franchiseWide ? "franchise" : "outlet"}
      className={className}
    >
      {franchiseWide ? "Franchise-wide" : "Outlet"}
    </MappingScopeBadge>
  )
}
