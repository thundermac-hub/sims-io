"use client"

import * as React from "react"
import {
  Background,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"
import type { Connection, Edge, Node, NodeProps } from "@xyflow/react"
import {
  AlertTriangle,
  CalendarDays,
  CircleDot,
  Layers,
  Link2Off,
  MessageSquare,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react"

import "@xyflow/react/dist/style.css"

import { formatDate } from "@/lib/dates"
import { computeGraphLayout } from "@/lib/project-graph"
import type { GraphNode } from "@/lib/project-graph"
import {
  PROJECT_ITEM_STATUSES,
  type MappedProjectItem,
  type ProjectItemStatus,
} from "@/lib/project-items"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { ItemStatusBadge } from "../item-status-badge"
import type { ProjectMember } from "../types"
import { ItemDialog } from "./item-dialog"
import { useProjectItemActions } from "./use-project-item-actions"

const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.75

/** Actions a node can invoke. Passed through node data by the canvas. */
type NodeCallbacks = {
  onAddActivity: (phaseId: string) => void
  onEdit: (itemId: string) => void
  onStatusChange: (itemId: string, status: string) => void
  onDelete: (itemId: string) => void
  onRestore: (itemId: string) => void
  onOpenComments: (itemId: string) => void
}

type ItemNodeData = GraphNode["data"] &
  NodeCallbacks & {
    /** The item's own id — a phase node needs it to parent a new activity. */
    selfId: string
    canEdit: boolean
    busy: boolean
    deleted: boolean
    /** False for an activity hidden only because its phase is deleted. */
    restorable: boolean
  }

const STATUS_BORDER: Record<ProjectItemStatus, string> = {
  "Not Started": "border-slate-300 dark:border-slate-600",
  "In Progress": "border-blue-400 dark:border-blue-500",
  Blocked: "border-rose-400 dark:border-rose-500",
  Completed: "border-emerald-400 dark:border-emerald-500",
}

/**
 * Custom node: an icon + title header with an actions menu and a delete button,
 * a divider, then the item's details.
 *
 * xyflow ships no dark theme, so every colour comes from the app's own Tailwind
 * tokens with both schemes covered explicitly. Interactive controls carry the
 * `nodrag` class so xyflow does not treat a click as the start of a canvas
 * gesture.
 */
function ItemNode({ data }: NodeProps<Node<ItemNodeData>>) {
  const isPhase = data.itemType === "Phase"
  const hasDates = Boolean(data.startDate || data.dueDate)
  const Icon = isPhase ? Layers : CircleDot

  return (
    <div
      className={`w-[260px] overflow-hidden rounded-lg border-2 bg-card shadow-sm ${
        STATUS_BORDER[data.status]
      } ${isPhase ? "" : "border-dashed"} ${
        data.unmetCount > 0 ? "ring-2 ring-amber-400/50" : ""
      } ${data.deleted ? "opacity-60" : ""}`}
    >
      {/* Drag between these handles to create a dependency. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !bg-muted-foreground"
      />

      {/* ---- Header ---- */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon
          className={`size-4 shrink-0 ${
            isPhase ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"
          }`}
        />
        <span
          className={`min-w-0 flex-1 truncate text-sm font-semibold ${
            data.deleted ? "line-through" : ""
          }`}
          title={data.label}
        >
          {data.label}
        </span>

        {data.canEdit ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Node actions"
                  disabled={data.busy}
                  className="nodrag text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded p-0.5 disabled:opacity-50"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Node Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {data.deleted ? (
                  <DropdownMenuItem
                    disabled={!data.restorable}
                    onSelect={() => data.onRestore(data.selfId)}
                  >
                    <RotateCcw />
                    {data.restorable ? "Restore" : "Restore the phase first"}
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => data.onEdit(data.selfId)}>
                      <Pencil />
                      Edit details
                    </DropdownMenuItem>

                    {isPhase ? (
                      <DropdownMenuItem
                        onSelect={() => data.onAddActivity(data.selfId)}
                      >
                        <Plus />
                        Add activity
                      </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <CircleDot />
                        Set status
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={data.status}
                          onValueChange={(status) =>
                            data.onStatusChange(data.selfId, status)
                          }
                        >
                          {PROJECT_ITEM_STATUSES.map((option) => (
                            <DropdownMenuRadioItem key={option} value={option}>
                              {option}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem
                      onSelect={() => data.onOpenComments(data.selfId)}
                    >
                      <MessageSquare />
                      Comments
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => data.onDelete(data.selfId)}
                    >
                      <Trash2 />
                      Delete node
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {data.deleted ? null : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Delete ${data.label}`}
                    disabled={data.busy}
                    className="nodrag text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded p-0.5 disabled:opacity-50"
                    onClick={() => data.onDelete(data.selfId)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete node</TooltipContent>
              </Tooltip>
            )}
          </>
        ) : null}
      </div>

      <div className="border-t" />

      {/* ---- Body ---- */}
      <div className="space-y-1.5 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <ItemStatusBadge status={data.status} />
          {data.unmetCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              {data.unmetCount} unmet
            </span>
          ) : null}
          {data.unlinkedPhase ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400">
                  <Link2Off className="size-3" />
                  Unlinked
                </span>
              </TooltipTrigger>
              <TooltipContent>
                This phase is not connected to any other phase. Drag from another
                phase to place it in the sequence.
              </TooltipContent>
            </Tooltip>
          ) : null}
          {data.deleted ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
              {data.restorable ? "Deleted" : "Phase deleted"}
            </span>
          ) : null}
        </div>

        {hasDates ? (
          <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <CalendarDays className="size-3 shrink-0" />
            <span>
              {data.startDate ? formatDate(data.startDate) : "—"}
              {" → "}
              {data.dueDate ? formatDate(data.dueDate) : "—"}
            </span>
          </div>
        ) : null}

        <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <User className="size-3 shrink-0" />
          <span className="truncate">{data.assignedUserName ?? "Unassigned"}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !bg-muted-foreground"
      />
    </div>
  )
}

const NODE_TYPES = { item: ItemNode }

/** Zoom slider wired to the xyflow viewport. Must live inside ReactFlowProvider. */
function ZoomSlider() {
  const { zoomTo, getZoom, fitView } = useReactFlow()
  const [zoom, setZoom] = React.useState(1)

  // Keep the slider in step with pinch/scroll zooming on the canvas.
  React.useEffect(() => {
    const interval = setInterval(() => {
      const current = getZoom()
      setZoom((previous) =>
        Math.abs(previous - current) > 0.01 ? current : previous
      )
    }, 200)
    return () => clearInterval(interval)
  }, [getZoom])

  const apply = (next: number) => {
    setZoom(next)
    zoomTo(next, { duration: 80 })
  }

  return (
    <div className="bg-card/95 absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm backdrop-blur">
      <button
        type="button"
        aria-label="Zoom out"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => apply(Math.max(MIN_ZOOM, zoom - 0.15))}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="range"
        aria-label="Zoom level"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.05}
        value={zoom}
        onChange={(event) => apply(Number(event.target.value))}
        className="accent-foreground h-1 w-28 cursor-pointer"
      />
      <button
        type="button"
        aria-label="Zoom in"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => apply(Math.min(MAX_ZOOM, zoom + 0.15))}
      >
        <Plus className="size-4" />
      </button>
      <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground border-l pl-2 text-[11px] font-medium"
        onClick={() => fitView({ duration: 200 })}
      >
        Fit
      </button>
    </div>
  )
}

type DependencyGraphProps = {
  projectId: string
  items: MappedProjectItem[]
  dependencies: MappedDependency[]
  members: ProjectMember[]
  canEdit: boolean
  showDeleted: boolean
  onChanged: () => void
  /** Jump to the Comments tab focused on an item. */
  onOpenComments: (itemId: string) => void
}

function DependencyGraphCanvas({
  projectId,
  items,
  dependencies,
  members,
  canEdit,
  showDeleted,
  onChanged,
  onOpenComments,
}: DependencyGraphProps) {
  const { showToast } = useToast()
  const actions = useProjectItemActions(projectId, onChanged)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogType, setDialogType] =
    React.useState<"Phase" | "Activity">("Phase")
  const [dialogParentId, setDialogParentId] = React.useState<string | null>(null)
  const [editingItem, setEditingItem] = React.useState<MappedProjectItem | null>(
    null
  )
  const [deletingItem, setDeletingItem] = React.useState<MappedProjectItem | null>(
    null
  )
  const [connecting, setConnecting] = React.useState(false)

  const itemsById = React.useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )

  const visibleItems = React.useMemo(
    () => (showDeleted ? items : items.filter((item) => !item.effectivelyDeleted)),
    [items, showDeleted]
  )

  // Layout is computed by our own pure function rather than a layout engine — the
  // hierarchy is only two levels deep, so topological rank plus item order is
  // enough and keeps dagre/elk out of the bundle.
  const layout = React.useMemo(
    () => computeGraphLayout(visibleItems, dependencies),
    [dependencies, visibleItems]
  )

  const callbacks = React.useMemo<NodeCallbacks>(
    () => ({
      onAddActivity: (phaseId) => {
        setEditingItem(null)
        setDialogType("Activity")
        setDialogParentId(phaseId)
        setDialogOpen(true)
      },
      onEdit: (itemId) => {
        const item = itemsById.get(itemId)
        if (!item) {
          return
        }
        setEditingItem(item)
        setDialogType(item.itemType)
        setDialogParentId(item.parentItemId)
        setDialogOpen(true)
      },
      onStatusChange: (itemId, status) => {
        const item = itemsById.get(itemId)
        if (item && item.status !== status) {
          void actions.changeStatus(item, status)
        }
      },
      onDelete: (itemId) => {
        const item = itemsById.get(itemId)
        if (item) {
          setDeletingItem(item)
        }
      },
      onRestore: (itemId) => {
        const item = itemsById.get(itemId)
        if (item) {
          void actions.restoreItem(item)
        }
      },
      onOpenComments,
    }),
    [actions, itemsById, onOpenComments]
  )

  const nodes = React.useMemo<Node<ItemNodeData>[]>(
    () =>
      layout.nodes.map((node) => {
        const item = itemsById.get(node.id)
        return {
          id: node.id,
          type: "item",
          position: node.position,
          data: {
            ...node.data,
            ...callbacks,
            selfId: node.id,
            canEdit,
            busy: actions.busyItemId === node.id,
            deleted: item?.effectivelyDeleted ?? false,
            // An activity hidden only because its phase is deleted cannot be
            // restored on its own — the phase has to come back first.
            restorable: item?.deletedAt !== null && item?.deletedAt !== undefined,
          },
        }
      }),
    [actions.busyItemId, callbacks, canEdit, itemsById, layout.nodes]
  )

  const edges = React.useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.unmet,
        // Line style carries the item kind: phase-to-phase links are the
        // project's backbone and draw solid, anything involving an activity draws
        // dotted. Colour carries the dependency state: amber while the
        // prerequisite is outstanding, emerald once Completed.
        style: {
          stroke: edge.unmet ? "#f59e0b" : "#10b981",
          strokeWidth: 2,
          ...(edge.kind === "activity" ? { strokeDasharray: "2 4" } : {}),
        },
      })),
    [layout.edges]
  )

  /** Drag from one node's right handle to another's left handle to link them. */
  const handleConnect = React.useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || connecting) {
        return
      }
      setConnecting(true)
      try {
        const response = await fetch(`/api/projects/${projectId}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // The drag goes prerequisite → dependent, matching the left-to-right
            // reading of the diagram.
            itemId: connection.target,
            dependsOnItemId: connection.source,
          }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to link these items.")
        }
        const from = itemsById.get(connection.source)?.name ?? "item"
        const to = itemsById.get(connection.target)?.name ?? "item"
        showToast(`“${to}” now depends on “${from}”.`, "success")
        onChanged()
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Unable to link these items.",
          "error"
        )
      } finally {
        setConnecting(false)
      }
    },
    [connecting, itemsById, onChanged, projectId, showToast]
  )

  const unlinkedCount = layout.unlinkedPhaseIds.length
  const dialogParent = dialogParentId ? itemsById.get(dialogParentId) : null

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Project diagram</CardTitle>
          <CardDescription>
            Prerequisites sit to the left of what they block. Drag from a node&apos;s
            right edge to another node&apos;s left edge to link them. Solid lines
            join phases; dotted lines involve an activity. Amber means the
            prerequisite is not yet Completed.
          </CardDescription>
          {unlinkedCount > 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400">
              <Link2Off className="size-3.5" />
              {unlinkedCount} phase{unlinkedCount === 1 ? "" : "s"} not connected to
              another phase
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setEditingItem(null)
              setDialogType("Phase")
              setDialogParentId(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            New phase
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <div className="text-muted-foreground space-y-3 py-12 text-center text-sm">
            <p>No phases yet.</p>
            {canEdit ? (
              <p className="text-xs">
                Add a phase to start laying out this project, then add activities
                under it and connect phases to set the sequence.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="relative h-[560px] w-full overflow-hidden rounded-lg border">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              fitView
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              // Positions are derived from the dependency ranking, so dragging a
              // node would only be undone on the next refetch.
              nodesDraggable={false}
              nodesConnectable={canEdit}
              edgesFocusable={false}
              onConnect={(connection) => void handleConnect(connection)}
              proOptions={{ hideAttribution: false }}
            >
              <Background />
              <MiniMap pannable zoomable />
              <ZoomSlider />
            </ReactFlow>
          </div>
        )}
      </CardContent>

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        itemType={dialogType}
        parentItemId={dialogType === "Activity" ? dialogParentId : null}
        parentName={dialogParent?.name ?? null}
        item={editingItem}
        members={members}
        onSaved={onChanged}
        onNeedsConfirmation={(details) =>
          actions.setConfirmation({
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
            It will be hidden from the diagram but kept in full — comments,
            mentions, and history stay intact and it can be restored later.
            {deletingItem?.itemType === "Phase"
              ? " Its activities will be hidden too."
              : ""}
          </>
        }
        confirmLabel="Delete"
        destructive
        loading={actions.busy}
        onConfirm={() => {
          const pending = deletingItem
          setDeletingItem(null)
          if (pending) {
            void actions.deleteItem(pending)
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(actions.confirmation)}
        onOpenChange={(open) => {
          if (!open) {
            actions.setConfirmation(null)
          }
        }}
        title={actions.confirmation?.title ?? "Confirm"}
        description={
          <>
            {actions.confirmation?.message}
            {actions.confirmation?.names.length ? (
              <span className="mt-2 block text-xs">
                {actions.confirmation.names.join(", ")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={actions.confirmation?.confirmLabel ?? "Confirm"}
        destructive={actions.confirmation?.destructive}
        loading={actions.busy}
        onConfirm={() => {
          const pending = actions.confirmation
          actions.setConfirmation(null)
          if (pending) {
            void pending.retry()
          }
        }}
      />
    </Card>
  )
}

export function DependencyGraph(props: DependencyGraphProps) {
  // `useReactFlow` in ZoomSlider needs the provider above the canvas.
  return (
    <ReactFlowProvider>
      <DependencyGraphCanvas {...props} />
    </ReactFlowProvider>
  )
}
