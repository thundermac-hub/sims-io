import assert from "node:assert/strict"
import test from "node:test"

import {
  GRAPH_COLUMN_WIDTH,
  computeGraphLayout,
} from "./project-graph.ts"
import type { DependencyEdge } from "./project-dependencies.ts"
import type { ItemNode } from "./project-items.ts"

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

function edge(itemId: string, dependsOnItemId: string): DependencyEdge {
  return { itemId, dependsOnItemId }
}

/** Column index a node was placed in. */
function columnOf(
  layout: ReturnType<typeof computeGraphLayout>,
  id: string
): number {
  const found = layout.nodes.find((candidate) => candidate.id === id)
  assert.ok(found, `expected node ${id} in the layout`)
  return found.position.x / GRAPH_COLUMN_WIDTH
}

test("computeGraphLayout puts independent items in the first column", () => {
  const layout = computeGraphLayout([node({ id: "a" }), node({ id: "b" })], [])
  assert.equal(columnOf(layout, "a"), 0)
  assert.equal(columnOf(layout, "b"), 0)
})

test("computeGraphLayout ranks prerequisites to the left of what they block", () => {
  const items = [node({ id: "a" }), node({ id: "b" }), node({ id: "c" })]
  const layout = computeGraphLayout(items, [edge("b", "a"), edge("c", "b")])
  assert.equal(columnOf(layout, "a"), 0)
  assert.equal(columnOf(layout, "b"), 1)
  assert.equal(columnOf(layout, "c"), 2)
})

test("computeGraphLayout ranks a diamond by longest path", () => {
  // d waits on both b and c, which both wait on a, so d lands two columns over.
  const items = ["a", "b", "c", "d"].map((id) => node({ id }))
  const layout = computeGraphLayout(items, [
    edge("b", "a"),
    edge("c", "a"),
    edge("d", "b"),
    edge("d", "c"),
  ])
  assert.equal(columnOf(layout, "a"), 0)
  assert.equal(columnOf(layout, "b"), 1)
  assert.equal(columnOf(layout, "c"), 1)
  assert.equal(columnOf(layout, "d"), 2)
})

test("computeGraphLayout gives items in the same column distinct rows", () => {
  const items = [
    node({ id: "p1", name: "Alpha", sortOrder: 0 }),
    node({ id: "p2", name: "Beta", sortOrder: 1 }),
  ]
  const layout = computeGraphLayout(items, [])
  const ys = layout.nodes.map((n) => n.position.y)
  assert.equal(new Set(ys).size, ys.length)
})

test("computeGraphLayout keeps activities adjacent to their phase", () => {
  const items = [
    node({ id: "p1", name: "Alpha", sortOrder: 0 }),
    node({ id: "p2", name: "Beta", sortOrder: 1 }),
    node({ id: "a1", itemType: "Activity", parentItemId: "p1", name: "A1" }),
    node({ id: "b1", itemType: "Activity", parentItemId: "p2", name: "B1" }),
  ]
  const layout = computeGraphLayout(items, [])
  const order = [...layout.nodes]
    .sort((a, b) => a.position.y - b.position.y)
    .map((n) => n.id)
  assert.deepEqual(order, ["p1", "a1", "p2", "b1"])
})

test("computeGraphLayout excludes deleted items and their edges", () => {
  const items = [
    node({ id: "a" }),
    node({ id: "b", effectivelyDeleted: true }),
  ]
  const layout = computeGraphLayout(items, [edge("b", "a")])
  assert.deepEqual(layout.nodes.map((n) => n.id), ["a"])
  assert.deepEqual(layout.edges, [])
})

test("computeGraphLayout marks edges unmet until the prerequisite is Completed", () => {
  const pending = computeGraphLayout(
    [node({ id: "a", status: "In Progress" }), node({ id: "b" })],
    [edge("b", "a")]
  )
  assert.equal(pending.edges[0].unmet, true)

  const satisfied = computeGraphLayout(
    [node({ id: "a", status: "Completed" }), node({ id: "b" })],
    [edge("b", "a")]
  )
  assert.equal(satisfied.edges[0].unmet, false)
})

test("computeGraphLayout carries the unmet count onto the node", () => {
  const layout = computeGraphLayout(
    [
      node({ id: "a", status: "Completed" }),
      node({ id: "b", status: "Blocked" }),
      node({ id: "c" }),
    ],
    [edge("c", "a"), edge("c", "b")]
  )
  const c = layout.nodes.find((n) => n.id === "c")
  assert.equal(c?.data.unmetCount, 1)
})

test("computeGraphLayout directs edges from prerequisite to dependent", () => {
  const layout = computeGraphLayout(
    [node({ id: "a" }), node({ id: "b" })],
    [edge("b", "a")]
  )
  assert.deepEqual(
    { source: layout.edges[0].source, target: layout.edges[0].target },
    { source: "a", target: "b" }
  )
})

test("computeGraphLayout places cyclic leftovers instead of dropping them", () => {
  // The API rejects cycles, but a legacy row must never make work disappear.
  const items = [node({ id: "a" }), node({ id: "b" }), node({ id: "c" })]
  const layout = computeGraphLayout(items, [
    edge("a", "b"),
    edge("b", "a"),
    edge("c", "a"),
  ])
  assert.equal(layout.nodes.length, 3)
})

test("computeGraphLayout is deterministic for the same input", () => {
  const items = [
    node({ id: "p1", name: "Alpha" }),
    node({ id: "p2", name: "Beta" }),
    node({ id: "a1", itemType: "Activity", parentItemId: "p1", name: "A1" }),
  ]
  const edges = [edge("p2", "p1")]
  assert.deepEqual(
    computeGraphLayout(items, edges),
    computeGraphLayout(items, edges)
  )
})

test("computeGraphLayout returns an empty layout for no items", () => {
  assert.deepEqual(computeGraphLayout([], []), { nodes: [], edges: [] })
})
