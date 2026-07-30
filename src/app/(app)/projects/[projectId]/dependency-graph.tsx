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
import { AlertTriangle, CalendarDays, Link2Off, Minus, Plus, User } from "lucide-react"

import "@xyflow/react/dist/style.css"

import { formatDate } from "@/lib/dates"
import { computeGraphLayout } from "@/lib/project-graph"
import type { GraphNode } from "@/lib/project-graph"
import type { MappedProjectItem, ProjectItemStatus } from "@/lib/project-items"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { ItemStatusBadge } from "../item-status-badge"
import type { ProjectMember } from "../types"
import { ItemDialog } from "./item-dialog"

const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.75

type ItemNodeData = GraphNode["data"] & {
  /** The item's own id — needed so a phase node can parent a new activity. */
  selfId: string
  canEdit: boolean
  onAddActivity: (phaseId: string) => void
}

const STATUS_BORDER: Record<ProjectItemStatus, string> = {
  "Not Started": "border-slate-300 dark:border-slate-600",
  "In Progress": "border-blue-400 dark:border-blue-500",
  Blocked: "border-rose-400 dark:border-rose-500",
  Completed: "border-emerald-400 dark:border-emerald-500",
}

/**
 * Custom node. xyflow ships no dark theme, so every colour comes from the app's
 * own Tailwind tokens with both schemes covered explicitly.
 */
function ItemNode({ data }: NodeProps<Node<ItemNodeData>>) {
  const isPhase = data.itemType === "Phase"
  const hasDates = Boolean(data.startDate || data.dueDate)

  return (
    <div
      className={`w-[240px] rounded-lg border-2 bg-card px-3 py-2 shadow-sm ${
        STATUS_BORDER[data.status]
      } ${isPhase ? "" : "border-dashed"} ${
        data.unmetCount > 0 ? "ring-2 ring-amber-400/50" : ""
      }`}
    >
      {/* Connection handles are the only way to create a dependency on the canvas:
          drag from a node's right edge to another node's left edge. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !bg-muted-foreground"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          {data.itemType}
        </span>
        {data.unlinkedPhase ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400">
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
      </div>

      <div className="mt-0.5 text-sm leading-snug font-medium break-words">
        {data.label}
      </div>

      {hasDates ? (
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
          <CalendarDays className="size-3 shrink-0" />
          <span>
            {data.startDate ? formatDate(data.startDate) : "—"}
            {" → "}
            {data.dueDate ? formatDate(data.dueDate) : "—"}
          </span>
        </div>
      ) : null}

      {data.assignedUserName ? (
        <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
          <User className="size-3 shrink-0" />
          <span className="truncate">{data.assignedUserName}</span>
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <ItemStatusBadge status={data.status} />
        {data.unmetCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            {data.unmetCount} unmet
          </span>
        ) : null}
      </div>

      {isPhase && data.canEdit ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground hover:bg-accent mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed py-1 text-[11px] font-medium"
          onClick={() => data.onAddActivity(data.selfId)}
        >
          <Plus className="size-3" />
          Add activity
        </button>
      ) : null}

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
  onChanged: () => void
}

function DependencyGraphCanvas({
  projectId,
  items,
  dependencies,
  members,
  canEdit,
  onChanged,
}: DependencyGraphProps) {
  const { showToast } = useToast()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogType, setDialogType] =
    React.useState<"Phase" | "Activity">("Phase")
  const [dialogParentId, setDialogParentId] = React.useState<string | null>(null)
  const [connecting, setConnecting] = React.useState(false)

  // Layout is computed by our own pure function rather than a layout engine — the
  // hierarchy is only two levels deep, so topological rank plus item order is
  // enough and keeps dagre/elk out of the bundle.
  const layout = React.useMemo(
    () => computeGraphLayout(items, dependencies),
    [dependencies, items]
  )

  const itemsById = React.useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )

  const openAddActivity = React.useCallback((phaseId: string) => {
    setDialogType("Activity")
    setDialogParentId(phaseId)
    setDialogOpen(true)
  }, [])

  const nodes = React.useMemo<Node<ItemNodeData>[]>(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "item",
        position: node.position,
        data: {
          ...node.data,
          selfId: node.id,
          canEdit,
          onAddActivity: openAddActivity,
        },
      })),
    [canEdit, layout.nodes, openAddActivity]
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
        members={members}
        onSaved={onChanged}
        onNeedsConfirmation={() => {
          // Only reachable when completing a phase with open activities, which
          // cannot happen from this create-only dialog.
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
