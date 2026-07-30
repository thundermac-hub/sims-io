"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"

import { buildItemTree } from "@/lib/project-items"
import type { MappedProjectItem } from "@/lib/project-items"
import type { MappedDependency } from "@/lib/project-dependencies"
import { useToast } from "@/components/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ItemStatusBadge } from "../item-status-badge"

const NO_SELECTION = "__none__"

type DependencyPanelProps = {
  projectId: string
  items: MappedProjectItem[]
  dependencies: MappedDependency[]
  canEdit: boolean
  onDependenciesChanged: () => void
}

export function DependencyPanel({
  projectId,
  items,
  dependencies,
  canEdit,
  onDependenciesChanged,
}: DependencyPanelProps) {
  const { showToast } = useToast()
  const [selectedItemId, setSelectedItemId] = React.useState(NO_SELECTION)
  const [prerequisiteId, setPrerequisiteId] = React.useState(NO_SELECTION)
  const [busy, setBusy] = React.useState(false)

  const liveItems = React.useMemo(
    () => items.filter((item) => !item.effectivelyDeleted),
    [items]
  )
  const itemsById = React.useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )

  // Ordered phase-then-activity list so both pickers read like the item tree.
  const orderedItems = React.useMemo(() => {
    const flat: MappedProjectItem[] = []
    for (const phase of buildItemTree(liveItems)) {
      const { activities, ...rest } = phase
      flat.push(rest as MappedProjectItem)
      flat.push(...activities)
    }
    return flat
  }, [liveItems])

  const selectedItem =
    selectedItemId === NO_SELECTION ? null : itemsById.get(selectedItemId) ?? null

  const dependsOn = React.useMemo(
    () =>
      selectedItem
        ? dependencies.filter((dep) => dep.itemId === selectedItem.id)
        : [],
    [dependencies, selectedItem]
  )
  const blocks = React.useMemo(
    () =>
      selectedItem
        ? dependencies.filter((dep) => dep.dependsOnItemId === selectedItem.id)
        : [],
    [dependencies, selectedItem]
  )

  // Candidates exclude the item itself, anything it already depends on, and its
  // own ancestors/descendants — the server rejects those, so don't offer them.
  const candidates = React.useMemo(() => {
    if (!selectedItem) {
      return []
    }
    const existing = new Set(dependsOn.map((dep) => dep.dependsOnItemId))
    return orderedItems.filter((candidate) => {
      if (candidate.id === selectedItem.id || existing.has(candidate.id)) {
        return false
      }
      if (candidate.parentItemId === selectedItem.id) {
        return false
      }
      if (selectedItem.parentItemId === candidate.id) {
        return false
      }
      return true
    })
  }, [dependsOn, orderedItems, selectedItem])

  const handleAdd = async () => {
    if (!selectedItem || prerequisiteId === NO_SELECTION) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          dependsOnItemId: prerequisiteId,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to add dependency.")
      }
      showToast("Dependency added.", "success")
      setPrerequisiteId(NO_SELECTION)
      onDependenciesChanged()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to add dependency.",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (dependencyId: string) => {
    setBusy(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/dependencies?dependencyId=${encodeURIComponent(dependencyId)}`,
        { method: "DELETE" }
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to remove dependency.")
      }
      showToast("Dependency removed.", "success")
      onDependenciesChanged()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to remove dependency.",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  const renderLinkedItem = (
    dependencyId: string,
    itemId: string,
    kind: "prerequisite" | "dependent"
  ) => {
    const linked = itemsById.get(itemId)
    return (
      <li
        key={dependencyId}
        className="flex items-center justify-between gap-2 border-t px-3 py-2 first:border-t-0"
      >
        <div className="min-w-0">
          <span className="text-sm font-medium">{linked?.name ?? "Unknown item"}</span>
          <span className="text-muted-foreground ml-2 text-xs">
            {linked?.itemType ?? ""}
            {linked?.effectivelyDeleted ? " · deleted" : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {linked ? <ItemStatusBadge status={linked.status} /> : null}
          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={`Remove ${kind}`}
              onClick={() => void handleRemove(dependencyId)}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dependencies</CardTitle>
        <CardDescription>
          Finish-to-start: an item is only unblocked once every prerequisite is
          Completed. A phase and its own activities cannot depend on each other, and
          loops are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-[320px]">
              <SelectValue placeholder="Select a phase or activity" />
            </SelectTrigger>
            <SelectContent>
              {orderedItems.length === 0 ? (
                <SelectItem value={NO_SELECTION} disabled>
                  No items yet
                </SelectItem>
              ) : (
                orderedItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.itemType === "Activity" ? "— " : ""}
                    {item.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {!selectedItem ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Select an item to see and edit what it depends on.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Depends on</h3>
              {dependsOn.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border px-3 py-4 text-xs">
                  No prerequisites — this item is not waiting on anything.
                </p>
              ) : (
                <ul className="rounded-lg border bg-card">
                  {dependsOn.map((dep) =>
                    renderLinkedItem(dep.id, dep.dependsOnItemId, "prerequisite")
                  )}
                </ul>
              )}
              {canEdit ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={prerequisiteId} onValueChange={setPrerequisiteId}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Add a prerequisite" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.length === 0 ? (
                        <SelectItem value={NO_SELECTION} disabled>
                          No eligible items
                        </SelectItem>
                      ) : (
                        candidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.itemType === "Activity" ? "— " : ""}
                            {candidate.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={busy || prerequisiteId === NO_SELECTION}
                    onClick={() => void handleAdd()}
                  >
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Blocks</h3>
              {blocks.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border px-3 py-4 text-xs">
                  Nothing is waiting on this item.
                </p>
              ) : (
                <ul className="rounded-lg border bg-card">
                  {blocks.map((dep) =>
                    renderLinkedItem(dep.id, dep.itemId, "dependent")
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
