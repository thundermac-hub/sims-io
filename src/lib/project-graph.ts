import { COMPLETED_STATUS } from "./project-items.ts"
import type { ItemNode, ProjectItemStatus } from "./project-items.ts"
import { computeDependencyStatus } from "./project-dependencies.ts"
import type { DependencyEdge } from "./project-dependencies.ts"

export const GRAPH_COLUMN_WIDTH = 280
export const GRAPH_ROW_HEIGHT = 108

export type GraphNode = {
  id: string
  position: { x: number; y: number }
  data: {
    label: string
    itemType: "Phase" | "Activity"
    status: ProjectItemStatus
    parentItemId: string | null
    unmetCount: number
  }
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  /** True when the prerequisite is not yet Completed, so the edge reads as blocking. */
  unmet: boolean
}

export type GraphLayout = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Lays out the dependency graph deterministically.
 *
 * `@xyflow/react` has no built-in auto-layout, and pulling in dagre or elk for a
 * two-level hierarchy with a handful of edges is not worth the dependency. The
 * structure here is already almost sorted:
 *
 *  - x comes from the topological rank over the dependency edges (Kahn's
 *    algorithm), so prerequisites always sit to the left of what they block.
 *  - y comes from the item's own ordering within its rank, with activities kept
 *    adjacent to their phase.
 *
 * Deleted items are excluded. Any items left in a cycle — which the API rejects,
 * but a legacy row could in principle still form — are placed in a final column
 * rather than dropped, so the graph never silently loses work.
 */
export function computeGraphLayout<T extends ItemNode>(
  items: readonly T[],
  edges: readonly DependencyEdge[]
): GraphLayout {
  const live = items.filter((item) => !item.effectivelyDeleted)
  const liveIds = new Set(live.map((item) => item.id))
  const liveEdges = edges.filter(
    (edge) => liveIds.has(edge.itemId) && liveIds.has(edge.dependsOnItemId)
  )

  // Kahn's algorithm over the precedence graph (predecessor → successor).
  const successorsOf = new Map<string, string[]>()
  const inDegree = new Map<string, number>(live.map((item) => [item.id, 0]))
  for (const edge of liveEdges) {
    const list = successorsOf.get(edge.dependsOnItemId)
    if (list) {
      list.push(edge.itemId)
    } else {
      successorsOf.set(edge.dependsOnItemId, [edge.itemId])
    }
    inDegree.set(edge.itemId, (inDegree.get(edge.itemId) ?? 0) + 1)
  }

  const rank = new Map<string, number>()
  let frontier = live
    .filter((item) => (inDegree.get(item.id) ?? 0) === 0)
    .map((item) => item.id)
  for (const id of frontier) {
    rank.set(id, 0)
  }

  const remaining = new Map(inDegree)
  let currentRank = 0
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      for (const successor of successorsOf.get(id) ?? []) {
        const left = (remaining.get(successor) ?? 0) - 1
        remaining.set(successor, left)
        if (left === 0) {
          rank.set(successor, currentRank + 1)
          next.push(successor)
        }
      }
    }
    currentRank += 1
    frontier = next
  }

  // Anything still unranked sits in a cycle; park it one column past the rest.
  const maxRank = rank.size > 0 ? Math.max(...rank.values()) : 0
  for (const item of live) {
    if (!rank.has(item.id)) {
      rank.set(item.id, maxRank + 1)
    }
  }

  // Within a column, order by phase-then-activity so a phase and its activities
  // stay visually grouped, then by the item's own sort order and name.
  const orderKey = new Map<string, string>()
  const byId = new Map(live.map((item) => [item.id, item]))
  for (const item of live) {
    const phase = item.parentItemId ? byId.get(item.parentItemId) : item
    const phaseOrder = String(phase?.sortOrder ?? 0).padStart(6, "0")
    const phaseName = phase?.name ?? ""
    const own = item.parentItemId
      ? `1-${String(item.sortOrder).padStart(6, "0")}-${item.name}`
      : "0"
    orderKey.set(item.id, `${phaseOrder}-${phaseName}-${own}`)
  }

  const columns = new Map<number, T[]>()
  for (const item of live) {
    const column = rank.get(item.id) ?? 0
    const list = columns.get(column)
    if (list) {
      list.push(item)
    } else {
      columns.set(column, [item])
    }
  }

  const dependencyStatus = computeDependencyStatus(items, edges)
  const nodes: GraphNode[] = []
  for (const [column, columnItems] of [...columns.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const sorted = [...columnItems].sort((a, b) =>
      (orderKey.get(a.id) ?? "").localeCompare(orderKey.get(b.id) ?? "")
    )
    sorted.forEach((item, row) => {
      nodes.push({
        id: item.id,
        position: {
          x: column * GRAPH_COLUMN_WIDTH,
          // Activities are inset so the hierarchy reads at a glance.
          y: row * GRAPH_ROW_HEIGHT,
        },
        data: {
          label: item.name,
          itemType: item.itemType,
          status: item.status,
          parentItemId: item.parentItemId,
          unmetCount: dependencyStatus.get(item.id)?.unmet.length ?? 0,
        },
      })
    })
  }

  const graphEdges: GraphEdge[] = liveEdges.map((edge) => {
    const predecessor = byId.get(edge.dependsOnItemId)
    return {
      id: `${edge.dependsOnItemId}-${edge.itemId}`,
      source: edge.dependsOnItemId,
      target: edge.itemId,
      unmet: predecessor ? predecessor.status !== COMPLETED_STATUS : false,
    }
  })

  return { nodes, edges: graphEdges }
}
