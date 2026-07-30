import { cn } from "@/lib/utils"
import type { ProjectItemStatus } from "@/lib/project-items"

const BASE_CLASS =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"

const STATUS_BADGE_CLASS: Record<ProjectItemStatus, string> = {
  "Not Started": "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  "In Progress": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Blocked: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  Completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
}

export function ItemStatusBadge({ status }: { status: ProjectItemStatus }) {
  return (
    <span className={cn(BASE_CLASS, STATUS_BADGE_CLASS[status])}>{status}</span>
  )
}
