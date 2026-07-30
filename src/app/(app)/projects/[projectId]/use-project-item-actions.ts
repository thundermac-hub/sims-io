"use client"

import * as React from "react"

import type { MappedProjectItem } from "@/lib/project-items"
import { useToast } from "@/components/toast-provider"

/**
 * A server-side 409 that needs the user to opt in before the write proceeds —
 * completing a phase with unfinished activities, or deleting an item other items
 * depend on. `retry` re-issues the same request with the confirmation flag set.
 */
export type PendingConfirmation = {
  title: string
  message: string
  names: string[]
  confirmLabel: string
  destructive?: boolean
  retry: () => Promise<void>
}

export type ProjectItemActions = {
  /** Id of the item currently being written, for per-row disabled states. */
  busyItemId: string | null
  busy: boolean
  changeStatus: (item: MappedProjectItem, status: string) => Promise<void>
  deleteItem: (item: MappedProjectItem) => Promise<void>
  restoreItem: (item: MappedProjectItem) => Promise<void>
  confirmation: PendingConfirmation | null
  setConfirmation: (confirmation: PendingConfirmation | null) => void
}

/**
 * Status / delete / restore for project items, shared by the Overview list and the
 * diagram so both surfaces handle the confirmation round-trips identically.
 *
 * Every gate is enforced by the API (the routes return 409 with
 * `requiresConfirmation`); this hook just turns that response into a dialog and
 * replays the request once the user agrees.
 */
export function useProjectItemActions(
  projectId: string,
  onItemsChanged: () => void
): ProjectItemActions {
  const { showToast } = useToast()
  const [busyItemId, setBusyItemId] = React.useState<string | null>(null)
  const [confirmation, setConfirmation] =
    React.useState<PendingConfirmation | null>(null)

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
        // A no-op save reports `changed: false`; stay quiet rather than claiming
        // something happened.
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
    async (item: MappedProjectItem, confirmDependents = false) => {
      setBusyItemId(item.id)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/items/${item.id}${
            confirmDependents ? "?confirmDependents=1" : ""
          }`,
          { method: "DELETE" }
        )
        const data = (await response.json()) as {
          item?: MappedProjectItem
          requiresConfirmation?: boolean
          dependentNames?: string[]
          error?: string
        }

        if (response.status === 409 && data.requiresConfirmation) {
          setConfirmation({
            title: "Delete anyway?",
            message: data.error ?? "Other items depend on this one.",
            names: data.dependentNames ?? [],
            confirmLabel: "Delete anyway",
            destructive: true,
            retry: () => deleteItem(item, true),
          })
          return
        }
        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Unable to delete.")
        }
        showToast(
          `${item.name} deleted. Its comments and history are kept and it can be restored.`,
          "success"
        )
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

  return {
    busyItemId,
    busy: busyItemId !== null,
    changeStatus: (item, status) => changeStatus(item, status),
    deleteItem: (item) => deleteItem(item),
    restoreItem,
    confirmation,
    setConfirmation,
  }
}
