"use client"

import * as React from "react"
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
} from "@xyflow/react"
import type { Edge, Node, NodeProps } from "@xyflow/react"
import { AlertTriangle } from "lucide-react"

import "@xyflow/react/dist/style.css"

import { computeGraphLayout } from "@/lib/project-graph"
import type { GraphNode } from "@/lib/project-graph"
import type { MappedProjectItem, ProjectItemStatus } from "@/lib/project-items"
import type { MappedDependency } from "@/lib/project-dependencies"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { ItemStatusBadge } from "../item-status-badge"

type ItemNodeData = GraphNode["data"]

const STATUS_BORDER: Record<ProjectItemStatus, string> = {
  "Not Started": "border-slate-300 dark:border-slate-600",
  "In Progress": "border-blue-400 dark:border-blue-500",
  Blocked: "border-rose-400 dark:border-rose-500",
  Completed: "border-emerald-400 dark:border-emerald-500",
}

/**
 * Custom node. xyflow ships no dark theme, so every colour here comes from the
 * app's own Tailwind tokens and both schemes are covered explicitly.
 */
function ItemNode({ data }: NodeProps<Node<ItemNodeData>>) {
  return (
    <div
      className={`w-[220px] rounded-lg border-2 bg-card px-3 py-2 shadow-sm ${
        STATUS_BORDER[data.status]
      } ${data.unmetCount > 0 ? "ring-2 ring-amber-400/50" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {data.itemType}
      </div>
      <div className="mt-0.5 text-sm leading-snug font-medium break-words">
        {data.label}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <ItemStatusBadge status={data.status} />
        {data.unmetCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            {data.unmetCount} unmet
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  )
}

const NODE_TYPES = { item: ItemNode }

type DependencyGraphProps = {
  items: MappedProjectItem[]
  dependencies: MappedDependency[]
}

export function DependencyGraph({ items, dependencies }: DependencyGraphProps) {
  // Layout is computed by our own pure function rather than a layout engine — the
  // hierarchy is only two levels deep, so topological rank plus item order is
  // enough and keeps dagre/elk out of the bundle.
  const layout = React.useMemo(
    () => computeGraphLayout(items, dependencies),
    [dependencies, items]
  )

  const nodes = React.useMemo<Node<ItemNodeData>[]>(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "item",
        position: node.position,
        data: node.data,
      })),
    [layout.nodes]
  )

  const edges = React.useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.unmet,
        // Amber and dashed while the prerequisite is outstanding; a plain solid
        // line once it is Completed.
        style: edge.unmet
          ? { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "6 4" }
          : { stroke: "#10b981", strokeWidth: 2 },
      })),
    [layout.edges]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dependency diagram</CardTitle>
        <CardDescription>
          Prerequisites sit to the left of what they block. An amber dashed
          connector means the prerequisite is not yet Completed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Add phases and activities to see the diagram.
          </p>
        ) : (
          <div className="h-[540px] w-full overflow-hidden rounded-lg border">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              fitView
              // Read-only: the graph reflects the data, it is not an editor. The
              // Dependencies tab is where edges are added and removed.
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              proOptions={{ hideAttribution: false }}
            >
              <Background />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
