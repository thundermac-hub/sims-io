import assert from "node:assert/strict"
import test from "node:test"

import {
  buildItemTree,
  findIncompleteChildren,
  isProjectItemStatus,
  isProjectItemType,
  isValidActivityParent,
  validateItemInput,
} from "./project-items.ts"
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

test("buildItemTree nests activities under their phase", () => {
  const tree = buildItemTree([
    node({ id: "p1", name: "Discovery", sortOrder: 0 }),
    node({ id: "p2", name: "Build", sortOrder: 1 }),
    node({ id: "a1", itemType: "Activity", parentItemId: "p1", name: "Interviews" }),
    node({ id: "a2", itemType: "Activity", parentItemId: "p2", name: "API" }),
  ])

  assert.deepEqual(
    tree.map((phase) => [phase.id, phase.activities.map((a) => a.id)]),
    [
      ["p1", ["a1"]],
      ["p2", ["a2"]],
    ]
  )
})

test("buildItemTree orders by sortOrder then name", () => {
  const tree = buildItemTree([
    node({ id: "p2", name: "Beta", sortOrder: 1 }),
    node({ id: "p1", name: "Alpha", sortOrder: 0 }),
    node({ id: "p3", name: "Aardvark", sortOrder: 1 }),
    node({ id: "a2", itemType: "Activity", parentItemId: "p1", name: "Zebra", sortOrder: 0 }),
    node({ id: "a1", itemType: "Activity", parentItemId: "p1", name: "Apple", sortOrder: 0 }),
  ])

  // sortOrder 1 ties broken by name: "Aardvark" before "Beta".
  assert.deepEqual(tree.map((phase) => phase.id), ["p1", "p3", "p2"])
  assert.deepEqual(tree[0].activities.map((a) => a.id), ["a1", "a2"])
})

test("buildItemTree drops orphan activities rather than promoting them", () => {
  const tree = buildItemTree([
    node({ id: "p1" }),
    node({ id: "orphan", itemType: "Activity", parentItemId: "missing-phase" }),
  ])

  assert.equal(tree.length, 1)
  assert.equal(tree[0].id, "p1")
  assert.equal(tree[0].activities.length, 0)
})

test("buildItemTree returns an empty list for no input", () => {
  assert.deepEqual(buildItemTree([]), [])
})

test("findIncompleteChildren reports live, unfinished activities only", () => {
  const items = [
    node({ id: "p1" }),
    node({
      id: "a1",
      itemType: "Activity",
      parentItemId: "p1",
      name: "Open work",
      status: "In Progress",
    }),
    node({
      id: "a2",
      itemType: "Activity",
      parentItemId: "p1",
      name: "Done",
      status: "Completed",
    }),
    node({
      id: "a3",
      itemType: "Activity",
      parentItemId: "p1",
      name: "Deleted work",
      status: "Blocked",
      effectivelyDeleted: true,
    }),
    node({
      id: "a4",
      itemType: "Activity",
      parentItemId: "other-phase",
      name: "Other phase",
      status: "Blocked",
    }),
  ]

  assert.deepEqual(
    findIncompleteChildren(items, "p1").map((item) => item.id),
    ["a1"]
  )
})

test("findIncompleteChildren is empty when every activity is completed", () => {
  const items = [
    node({ id: "p1" }),
    node({
      id: "a1",
      itemType: "Activity",
      parentItemId: "p1",
      status: "Completed",
    }),
  ]
  assert.deepEqual(findIncompleteChildren(items, "p1"), [])
})

test("isValidActivityParent accepts a phase and rejects deeper nesting", () => {
  assert.equal(
    isValidActivityParent({ itemType: "Phase", parentItemId: null }),
    true
  )
  // An activity can never be a parent — that would be a third level.
  assert.equal(
    isValidActivityParent({ itemType: "Activity", parentItemId: "p1" }),
    false
  )
  assert.equal(isValidActivityParent(null), false)
})

test("type and status guards accept known values only", () => {
  assert.equal(isProjectItemType("Phase"), true)
  assert.equal(isProjectItemType("Milestone"), false)
  assert.equal(isProjectItemStatus("Blocked"), true)
  assert.equal(isProjectItemStatus("blocked"), false)
})

test("validateItemInput accepts a phase without a parent", () => {
  const result = validateItemInput({
    itemType: "Phase",
    name: "  Discovery  ",
    description: "  Research  ",
    status: "In Progress",
    startDate: "2026-08-01",
    dueDate: "2026-08-31",
  })
  assert.deepEqual(result, {
    ok: true,
    value: {
      itemType: "Phase",
      parentItemId: null,
      name: "Discovery",
      description: "Research",
      status: "In Progress",
      assignedUserId: null,
      startDate: "2026-08-01",
      dueDate: "2026-08-31",
    },
  })
})

test("validateItemInput defaults status and coerces optional fields", () => {
  const result = validateItemInput({
    itemType: "Activity",
    parentItemId: "7",
    name: "Interviews",
    assignedUserId: 42,
  })
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.value.status, "Not Started")
  assert.equal(result.ok && result.value.parentItemId, 7)
  assert.equal(result.ok && result.value.assignedUserId, 42)
  assert.equal(result.ok && result.value.description, null)
  assert.equal(result.ok && result.value.startDate, null)
})

test("validateItemInput enforces the phase/activity shape invariant", () => {
  assert.deepEqual(
    validateItemInput({ itemType: "Phase", name: "P", parentItemId: "3" }),
    { ok: false, error: "A phase cannot have a parent." }
  )
  assert.deepEqual(
    validateItemInput({ itemType: "Activity", name: "A" }),
    { ok: false, error: "An activity must belong to a phase." }
  )
})

test("validateItemInput rejects bad names, types, and statuses", () => {
  assert.equal(validateItemInput({ itemType: "Task", name: "x" }).ok, false)
  assert.equal(validateItemInput({ itemType: "Phase", name: "   " }).ok, false)
  assert.equal(
    validateItemInput({ itemType: "Phase", name: "a".repeat(201) }).ok,
    false
  )
  assert.equal(
    validateItemInput({ itemType: "Phase", name: "P", status: "Doing" }).ok,
    false
  )
})

test("validateItemInput rejects malformed dates and a due date before the start", () => {
  assert.equal(
    validateItemInput({ itemType: "Phase", name: "P", startDate: "01-08-2026" }).ok,
    false
  )
  assert.deepEqual(
    validateItemInput({
      itemType: "Phase",
      name: "P",
      startDate: "2026-08-10",
      dueDate: "2026-08-01",
    }),
    { ok: false, error: "Due date cannot be before the start date." }
  )
})

test("validateItemInput rejects a non-object body and bad ids", () => {
  assert.equal(validateItemInput(null).ok, false)
  assert.equal(
    validateItemInput({ itemType: "Activity", name: "A", parentItemId: "0" }).ok,
    false
  )
  assert.equal(
    validateItemInput({
      itemType: "Phase",
      name: "P",
      assignedUserId: "not-an-id",
    }).ok,
    false
  )
})
