import type { RowDataPacket } from "mysql2/promise"

// Relative `.ts` import so this module runs directly under `node --test`
// (the `@/` alias is bundler-only). Matches google-calendar.ts / meta-capi.ts.
import { COMPLETED_STATUS } from "./project-items.ts"
import type { ItemNode } from "./project-items.ts"

/** A single finish-to-start edge: `itemId` waits for `dependsOnItemId`. */
export type DependencyEdge = {
  itemId: string
  dependsOnItemId: string
}

export type DependencyConflict = "self" | "duplicate" | "ancestor" | "cycle"

export const DEPENDENCY_CONFLICT_MESSAGE: Record<DependencyConflict, string> = {
  self: "An item cannot depend on itself.",
  duplicate: "That dependency already exists.",
  ancestor:
    "A phase and its own activity cannot depend on each other — a phase only finishes after its activities do.",
  cycle:
    "That would create a circular dependency. Items cannot form a loop of prerequisites.",
}

/**
 * Checks whether adding `itemId → dependsOnItemId` would be invalid, and why.
 * Returns null when the edge is safe to insert.
 *
 * Runs entirely in memory over the project's full edge set: projects here hold
 * tens of items, so one query plus an O(V+E) walk beats a recursive SQL
 * reachability query and, unlike the SQL version, is unit-testable without a
 * database. (If a project ever grew to thousands of items, `WITH RECURSIVE` over
 * project_item_dependencies is the escape hatch.)
 *
 * Callers must run this inside the project row lock (`withProjectLock`) —
 * two concurrent inserts can each be acyclic in isolation yet form a cycle
 * together.
 */
export function findDependencyConflict(
  edges: readonly DependencyEdge[],
  parentByItemId: ReadonlyMap<string, string | null>,
  itemId: string,
  dependsOnItemId: string
): DependencyConflict | null {
  if (itemId === dependsOnItemId) {
    return "self"
  }

  if (
    edges.some(
      (edge) =>
        edge.itemId === itemId && edge.dependsOnItemId === dependsOnItemId
    )
  ) {
    return "duplicate"
  }

  // A phase depending on one of its own activities (or vice versa) is a cycle in
  // disguise: a phase is only done once its activities are, so the two can never
  // both be satisfied. The dependency edge set alone would not catch it.
  if (
    isAncestorOf(parentByItemId, itemId, dependsOnItemId) ||
    isAncestorOf(parentByItemId, dependsOnItemId, itemId)
  ) {
    return "ancestor"
  }

  // Build the precedence graph: an edge {itemId, dependsOnItemId} means the
  // predecessor must finish first, so precedence runs dependsOnItemId → itemId.
  const successorsOf = new Map<string, string[]>()
  for (const edge of edges) {
    const list = successorsOf.get(edge.dependsOnItemId)
    if (list) {
      list.push(edge.itemId)
    } else {
      successorsOf.set(edge.dependsOnItemId, [edge.itemId])
    }
  }

  // The proposed edge adds "dependsOnItemId precedes itemId". That closes a loop
  // exactly when itemId already precedes dependsOnItemId, so walk forward from
  // itemId and look for dependsOnItemId.
  const visited = new Set<string>([itemId])
  const stack = [itemId]
  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const next of successorsOf.get(current) ?? []) {
      if (next === dependsOnItemId) {
        return "cycle"
      }
      if (!visited.has(next)) {
        visited.add(next)
        stack.push(next)
      }
    }
  }

  return null
}

/** True when `ancestorId` is `descendantId`'s parent (directly or transitively). */
function isAncestorOf(
  parentByItemId: ReadonlyMap<string, string | null>,
  ancestorId: string,
  descendantId: string
): boolean {
  const seen = new Set<string>()
  let current = parentByItemId.get(descendantId) ?? null
  while (current !== null && !seen.has(current)) {
    if (current === ancestorId) {
      return true
    }
    seen.add(current)
    current = parentByItemId.get(current) ?? null
  }
  return false
}

export type DependencyStatus = {
  /** Direct prerequisites that are not yet Completed. */
  unmet: string[]
  /** All direct prerequisites. */
  all: string[]
}

/**
 * Computes each item's direct unmet prerequisites.
 *
 * Finish-to-start means only *direct* predecessors matter, so no traversal is
 * needed. Effectively-deleted predecessors are treated as satisfied: a deleted
 * prerequisite is no longer work anyone will finish, and counting it would leave
 * the dependent item permanently flagged.
 */
export function computeDependencyStatus<T extends ItemNode>(
  items: readonly T[],
  edges: readonly DependencyEdge[]
): Map<string, DependencyStatus> {
  const byId = new Map(items.map((item) => [item.id, item]))
  const result = new Map<string, DependencyStatus>()

  for (const edge of edges) {
    const entry = result.get(edge.itemId) ?? { unmet: [], all: [] }
    entry.all.push(edge.dependsOnItemId)

    const predecessor = byId.get(edge.dependsOnItemId)
    if (
      predecessor &&
      !predecessor.effectivelyDeleted &&
      predecessor.status !== COMPLETED_STATUS
    ) {
      entry.unmet.push(edge.dependsOnItemId)
    }
    result.set(edge.itemId, entry)
  }

  return result
}

export type DependencyRow = RowDataPacket & {
  id: string
  item_id: string
  depends_on_item_id: string
  created_at: string
}

export type MappedDependency = {
  id: string
  itemId: string
  dependsOnItemId: string
  createdAt: string
}

export function mapDependency(row: DependencyRow): MappedDependency {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    dependsOnItemId: String(row.depends_on_item_id),
    createdAt: row.created_at,
  }
}
