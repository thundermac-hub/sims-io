"use client"

import * as React from "react"
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react"

import { formatDate } from "@/lib/dates"
import {
  PROJECT_ITEM_STATUSES,
  buildItemTree,
} from "@/lib/project-items"
import type { MappedProjectItem, ProjectItemType } from "@/lib/project-items"
import { useToast } from "@/components/toast-provider"
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

type PendingConfirmation = {
  title: string
  message: string
  names: string[]
  confirmLabel: string
  retry: () => Promise<void>
}

type ItemTreeProps = {
  projectId: string
  items: MappedProjectItem[]
  members: ProjectMember[]
  canEdit: boolean
  showDeleted: boolean
  onShowDeletedChange: (showDeleted: boolean) => void
  onItemsChanged: () => void
}

export function ItemTree({
  projectId,
  items,
  members,
  canEdit,
  showDeleted,
  onShowDeletedChange,
  onItemsChanged,
}: ItemTreeProps) {
  const { showToast } = useToast()
  const [busyItemId, setBusyItemId] = React.useState<string | null>(null)
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
  const [confirmation, setConfirmation] =
    React.useState<PendingConfirmation | null>(null)

  const visibleItems = React.useMemo(
    () => (showDeleted ? items : items.filter((item) => !item.effectivelyDeleted)),
    [items, showDeleted]
  )
  const tree = React.useMemo(() => buildItemTree(visibleItems), [visibleItems])

  const openCreate = (type: ProjectItemType, parent: MappedProjectItem | null) => {
    setEditingItem(null)
    setDialogType(type)
    setDialogParent(parent)
    setDialogOpen(true)
  }

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

  const changeStatus = React.useCallback(
    async (item: MappedProjectItem, status: string, confirmed = false) => {
      setBusyItemId(item.id)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/items/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status,
              ...(confirmed ? { confirmIncompleteChildren: true } : {}),
            }),
          }
        )
        const data = (await response.json()) as {
          item?: MappedProjectItem
          changed?: boolean
          requiresConfirmation?: boolean
          incompleteNames?: string[]
          error?: string
        }

        if (response.status === 409 && data.requiresConfirmation) {
          setConfirmation({
            title: "Complete this phase anyway?",
            message: data.error ?? "This change needs confirmation.",
            names: data.incompleteNames ?? [],
            confirmLabel: "Mark completed",
            retry: () => changeStatus(item, status, true),
          })
          return
        }
        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Unable to update status.")
        }
        if (data.changed === false) {
          return
        }
        showToast(`${item.name} is now ${status}.`, "success")
        onItemsChanged()
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Unable to update status.",
          "error"
        )
      } finally {
        setBusyItemId(null)
      }
    },
    [onItemsChanged, projectId, showToast]
  )

  const deleteItem = React.useCallback(
    async (item: MappedProjectItem) => {
      setBusyItemId(item.id)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/items/${item.id}`,
          { method: "DELETE" }
        )
        const data = (await response.json()) as {
          item?: MappedProjectItem
          error?: string
        }
        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Unable to delete.")
        }
        showToast(
          `${item.name} deleted. Its comments and history are kept and it can be restored.`,
          "success"
        )
        setDeletingItem(null)
        onItemsChanged()
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Unable to delete.", "error")
      } finally {
        setBusyItemId(null)
      }
    },
    [onItemsChanged, projectId, showToast]
  )

  const restoreItem = React.useCallback(
    async (item: MappedProjectItem) => {
      setBusyItemId(item.id)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/items/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restore: true }),
          }
        )
        const data = (await response.json()) as {
          item?: MappedProjectItem
          error?: string
        }
        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Unable to restore.")
        }
        showToast(`${item.name} restored.`, "success")
        onItemsChanged()
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Unable to restore.", "error")
      } finally {
        setBusyItemId(null)
      }
    },
    [onItemsChanged, projectId, showToast]
  )

  const renderRow = (item: MappedProjectItem, isActivity: boolean) => {
    const busy = busyItemId === item.id
    const deleted = item.effectivelyDeleted
    // An activity hidden only because its phase is deleted cannot be restored on
    // its own — the phase has to come back first.
    const restorableHere = deleted && item.deletedAt !== null

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
              disabled={busy}
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
              {!isActivity ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openCreate("Activity", item)}
                >
                  <Plus className="size-4" />
                  Activity
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
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
              disabled={busy}
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
          {canEdit ? (
            <Button size="sm" onClick={() => openCreate("Phase", null)}>
              <Plus className="size-4" />
              New phase
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {tree.length === 0 ? (
          <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
            <p>No phases yet.</p>
            {canEdit ? (
              <p className="text-xs">
                Add a phase to start breaking this project down.
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
                    No activities in this phase yet.
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
        loading={Boolean(busyItemId)}
        onConfirm={() => {
          if (deletingItem) {
            void deleteItem(deletingItem)
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
        loading={Boolean(busyItemId)}
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
