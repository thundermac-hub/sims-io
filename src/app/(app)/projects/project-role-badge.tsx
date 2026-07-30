import { cn } from "@/lib/utils"
import type { EffectiveProjectRole } from "@/lib/projects"

const BASE_CLASS =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"

const ROLE_BADGE_CLASS: Record<EffectiveProjectRole, string> = {
  Owner: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  Editor: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Viewer: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  SuperAdminReadOnly: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

const ROLE_LABEL: Record<EffectiveProjectRole, string> = {
  Owner: "Owner",
  Editor: "Editor",
  Viewer: "Viewer",
  SuperAdminReadOnly: "Admin (read-only)",
}

function isEffectiveProjectRole(value: string): value is EffectiveProjectRole {
  return value in ROLE_BADGE_CLASS
}

/**
 * Shows the caller's access on a project. A null role means a Super Admin who is
 * viewing a project they were never added to — read-only visibility.
 */
export function ProjectRoleBadge({ role }: { role: string | null }) {
  const resolved: EffectiveProjectRole =
    role && isEffectiveProjectRole(role) ? role : "SuperAdminReadOnly"
  return (
    <span className={cn(BASE_CLASS, ROLE_BADGE_CLASS[resolved])}>
      {ROLE_LABEL[resolved]}
    </span>
  )
}
