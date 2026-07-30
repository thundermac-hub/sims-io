import assert from "node:assert/strict"
import test from "node:test"

import {
  computeDependencyStatus,
  findDependencyConflict,
} from "./project-dependencies.ts"
import type { DependencyEdge } from "./project-dependencies.ts"
import type { ItemNode } from "./project-items.ts"

/** Flat hierarchy: every item is a top-level phase with no parent. */
function flatParents(...ids: string[]): Map<string, string | null> {
  return new Map(ids.map((id) => [id, null]))
}

function edge(itemId: string, dependsOnItemId: string): DependencyEdge {
  return { itemId, dependsOnItemId }
}

test("rejects an item depending on itself", () => {
  assert.equal(
    findDependencyConflict([], flatParents("a"), "a", "a"),
    "self"
  )
})

test("rejects a duplicate edge", () => {
  assert.equal(
    findDependencyConflict([edge("b", "a")], flatParents("a", "b"), "b", "a"),
    "duplicate"
  )
})

test("allows the reverse of an existing edge only when it is not a cycle", () => {
  // b already depends on a, so a depending on b closes a 2-cycle.
  assert.equal(
    findDependencyConflict([edge("b", "a")], flatParents("a", "b"), "a", "b"),
    "cycle"
  )
})

test("detects a three-hop cycle", () => {
  // b←a, c←b already exist; adding a←c closes a→b→c→a.
  const edges = [edge("b", "a"), edge("c", "b")]
  assert.equal(
    findDependencyConflict(edges, flatParents("a", "b", "c"), "a", "c"),
    "cycle"
  )
})

test("detects a longer cycle through an unrelated branch", () => {
  const edges = [
    edge("b", "a"),
    edge("c", "b"),
    edge("d", "c"),
    edge("e", "a"),
  ]
  assert.equal(
    findDependencyConflict(edges, flatParents("a", "b", "c", "d", "e"), "a", "d"),
    "cycle"
  )
})

test("accepts a diamond — shared prerequisites are not a cycle", () => {
  // b and c both depend on a; d depends on b. Adding d←c keeps it acyclic.
  const edges = [edge("b", "a"), edge("c", "a"), edge("d", "b")]
  assert.equal(
    findDependencyConflict(edges, flatParents("a", "b", "c", "d"), "d", "c"),
    null
  )
})

test("accepts an unrelated new edge", () => {
  assert.equal(
    findDependencyConflict([edge("b", "a")], flatParents("a", "b", "c"), "c", "a"),
    null
  )
})

test("rejects a phase depending on its own activity, and the reverse", () => {
  // a1 is an activity of phase p. A phase only finishes after its activities, so
  // either direction is an unsatisfiable loop the edge set alone would not catch.
  const parents = new Map<string, string | null>([
    ["p", null],
    ["a1", "p"],
  ])
  assert.equal(findDependencyConflict([], parents, "p", "a1"), "ancestor")
  assert.equal(findDependencyConflict([], parents, "a1", "p"), "ancestor")
})

test("allows dependencies between activities in different phases", () => {
  const parents = new Map<string, string | null>([
    ["p1", null],
    ["p2", null],
    ["a1", "p1"],
    ["a2", "p2"],
  ])
  assert.equal(findDependencyConflict([], parents, "a2", "a1"), null)
})

test("allows an activity to depend on a different phase", () => {
  const parents = new Map<string, string | null>([
    ["p1", null],
    ["p2", null],
    ["a2", "p2"],
  ])
  assert.equal(findDependencyConflict([], parents, "a2", "p1"), null)
})

test("ancestor walk terminates on a corrupt parent loop", () => {
  // Defensive: the DB shape check makes this impossible, but the walk must not
  // hang if a parent chain ever loops.
  const parents = new Map<string, string | null>([
    ["x", "y"],
    ["y", "x"],
  ])
  assert.equal(findDependencyConflict([], parents, "z", "x"), null)
})

function node(overrides: Partial<ItemNode> & { id: string }): ItemNode {
  return {
    parentItemId: null,
    itemType: "Phase",
    name: overrides.id,
    status: "Not Started",
    sortOrder: 0,
    effectivelyDeleted: false,
    ...overrides,
  }
}

test("computeDependencyStatus flags prerequisites that are not Completed", () => {
  const items = [
    node({ id: "a", status: "In Progress" }),
    node({ id: "b" }),
  ]
  const status = computeDependencyStatus(items, [edge("b", "a")])
  assert.deepEqual(status.get("b"), { unmet: ["a"], all: ["a"] })
})

test("computeDependencyStatus treats a Completed prerequisite as satisfied", () => {
  const items = [node({ id: "a", status: "Completed" }), node({ id: "b" })]
  const status = computeDependencyStatus(items, [edge("b", "a")])
  assert.deepEqual(status.get("b"), { unmet: [], all: ["a"] })
})

test("computeDependencyStatus treats a deleted prerequisite as satisfied", () => {
  // Otherwise the dependent item could never clear its flag — a deleted
  // prerequisite is no longer work anyone will finish.
  const items = [
    node({ id: "a", status: "Blocked", effectivelyDeleted: true }),
    node({ id: "b" }),
  ]
  const status = computeDependencyStatus(items, [edge("b", "a")])
  assert.deepEqual(status.get("b"), { unmet: [], all: ["a"] })
})

test("computeDependencyStatus aggregates multiple prerequisites", () => {
  const items = [
    node({ id: "a", status: "Completed" }),
    node({ id: "b", status: "Blocked" }),
    node({ id: "c" }),
  ]
  const status = computeDependencyStatus(items, [edge("c", "a"), edge("c", "b")])
  assert.deepEqual(status.get("c"), { unmet: ["b"], all: ["a", "b"] })
})

test("computeDependencyStatus omits items with no prerequisites", () => {
  const status = computeDependencyStatus([node({ id: "a" })], [])
  assert.equal(status.get("a"), undefined)
  assert.equal(status.size, 0)
})
