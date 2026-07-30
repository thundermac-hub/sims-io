"use client"

import * as React from "react"
import { AlertTriangle, Pencil, RotateCcw, Trash2 } from "lucide-react"

import { formatDate } from "@/lib/dates"
import {
  PROJECT_ITEM_STATUSES,
  buildItemTree,
} from "@/lib/project-items"
import type { MappedProjectItem, ProjectItemType } from "@/lib/project-items"
import { computeDependencyStatus } from "@/lib/project-dependencies"
import type { MappedDependency } from "@/lib/project-dependencies"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ItemStatusBadge } from "../item-status-badge"
import type { ProjectMember } from "../types"
import { ItemDialog } from "./item-dialog"
import { useProjectItemActions } from "./use-project-item-actions"

type ItemTreeProps = {
  projectId: string
  items: MappedProjectItem[]
  dependencies: MappedDependency[]
  members: ProjectMember[]
  canEdit: boolean
  showDeleted: boolean
  onShowDeletedChange: (showDeleted: boolean) => void
  onItemsChanged: () => void
}

export function ItemTree({
  projectId,
  items,
  dependencies,
  members,
  canEdit,
  showDeleted,
  onShowDeletedChange,
  onItemsChanged,
}: ItemTreeProps) {
  // Status / delete / restore and their 409 confirmation round-trips are shared
  // with the diagram, so both surfaces behave identically.
  const {
    busyItemId,
    busy,
    changeStatus,
    deleteItem,
    restoreItem,
    confirmation,
    setConfirmation,
  } = useProjectItemActions(projectId, onItemsChanged)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogType, setDialogType] = React.useState<ProjectItemType>("Phase")
  const [dialogParent, setDialogParent] = React.useState<MappedProjectItem | null>(
    null
  )
  const [editingItem, setEditingItem] = React.useState<MappedProjectItem | null>(
    null
  )
  const [deletingItem, setDeletingItem] = React.useState<MappedProjectItem | null>(
    null
  )

  const visibleItems = React.useMemo(
    () => (showDeleted ? items : items.filter((item) => !item.effectivelyDeleted)),
    [items, showDeleted]
  )
  const tree = React.useMemo(() => buildItemTree(visibleItems), [visibleItems])

  // Unmet prerequisites are derived from the full item set, not the visible one,
  // so a prerequisite hidden by the "Show deleted" filter is still evaluated.
  const dependencyStatus = React.useMemo(
    () => computeDependencyStatus(items, dependencies),
    [dependencies, items]
  )
  const itemNameById = React.useMemo(
    () => new Map(items.map((item) => [item.id, item.name])),
    [items]
  )

  // Creation lives on the Diagram tab; this dialog is edit-only here.
  const openEdit = (item: MappedProjectItem) => {
    setEditingItem(item)
    setDialogType(item.itemType)
    setDialogParent(
      item.parentItemId
        ? items.find((candidate) => candidate.id === item.parentItemId) ?? null
        : null
    )
    setDialogOpen(true)
  }


  const renderRow = (item: MappedProjectItem, isActivity: boolean) => {
    // Shadowing-free name: the hook's `busy` is global, this is per-row.
    const rowBusy = busyItemId === item.id
    const deleted = item.effectivelyDeleted
    // An activity hidden only because its phase is deleted cannot be restored on
    // its own — the phase has to come back first.
    const restorableHere = deleted && item.deletedAt !== null
    const unmet = dependencyStatus.get(item.id)?.unmet ?? []

    return (
      <div
        key={item.id}
        className={`flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
          isActivity ? "bg-muted/10 pl-8" : ""
        } ${deleted ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-medium ${deleted ? "line-through" : ""} ${
                isActivity ? "text-sm" : ""
              }`}
            >
              {item.name}
            </span>
            {!isActivity ? (
              <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                Phase
              </span>
            ) : null}
            {deleted ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {item.deletedAt ? "Deleted" : "Phase deleted"}
              </span>
            ) : null}
            {!deleted && unmet.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3" />
                    {unmet.length} unmet
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Waiting on:{" "}
                  {unmet
                    .map((id) => itemNameById.get(id) ?? "Unknown item")
                    .join(", ")}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {item.description ? (
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {item.description}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {item.assignedUserName ? `${item.assignedUserName}` : "Unassigned"}
            {item.dueDate ? ` · due ${formatDate(item.dueDate)}` : ""}
            {item.deletedByName ? ` · deleted by ${item.deletedByName}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canEdit && !deleted ? (
            <Select
              value={item.status}
              disabled={rowBusy}
              onValueChange={(status) => void changeStatus(item, status)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ITEM_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ItemStatusBadge status={item.status} />
          )}

          {canEdit && !deleted ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={rowBusy}
                onClick={() => setDeletingItem(item)}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : null}

          {canEdit && restorableHere ? (
            <Button
              variant="outline"
              size="sm"
              disabled={rowBusy}
              onClick={() => void restoreItem(item)}
            >
              <RotateCcw className="size-4" />
              Restore
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Phases &amp; activities</CardTitle>
          <CardDescription>
            Update status, edit, and delete here. Phases and activities are created
            on the <strong>Diagram</strong> tab, where you can also connect them.
            Deleting hides an item from this view but keeps it — along with its
            comments — and it can be restored.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowDeletedChange(!showDeleted)}
          >
            {showDeleted ? "Hide deleted" : "Show deleted"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tree.length === 0 ? (
          <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
            <p>No phases yet.</p>
            {canEdit ? (
              <p className="text-xs">
                Open the <strong>Diagram</strong> tab to add your first phase.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            {tree.map((phase) => (
              <div key={phase.id}>
                {renderRow(phase, false)}
                {phase.activities.map((activity) => renderRow(activity, true))}
                {phase.activities.length === 0 && !phase.effectivelyDeleted ? (
                  <div className="text-muted-foreground border-t bg-muted/10 px-4 py-2 pl-8 text-xs">
                    No activities in this phase yet — add one from the Diagram tab.
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        itemType={dialogType}
        parentItemId={dialogParent?.id ?? null}
        parentName={dialogParent?.name ?? null}
        item={editingItem}
        members={members}
        onSaved={onItemsChanged}
        onNeedsConfirmation={(details) =>
          setConfirmation({
            title: "Complete this phase anyway?",
            message: details.message,
            names: details.names,
            confirmLabel: "Save anyway",
            retry: details.retry,
          })
        }
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null)
          }
        }}
        title={`Delete "${deletingItem?.name ?? ""}"?`}
        description={
          <>
            It will be hidden from this view but kept in full — comments, mentions,
            and history stay intact and it can be restored later.
            {deletingItem?.itemType === "Phase"
              ? " Its activities will be hidden too."
              : ""}
          </>
        }
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={() => {
          const pending = deletingItem
          // Close before the request: a 409 opens the dependents confirmation
          // next, and two stacked dialogs would fight for focus.
          setDeletingItem(null)
          if (pending) {
            void deleteItem(pending)
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmation(null)
          }
        }}
        title={confirmation?.title ?? "Confirm"}
        description={
          <>
            {confirmation?.message}
            {confirmation?.names.length ? (
              <span className="mt-2 block text-xs">
                {confirmation.names.join(", ")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={confirmation?.confirmLabel ?? "Confirm"}
        destructive={confirmation?.destructive}
        loading={busy}
        onConfirm={() => {
          const pending = confirmation
          setConfirmation(null)
          if (pending) {
            void pending.retry()
          }
        }}
      />
    </Card>
  )
}
