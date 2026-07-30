import type { RowDataPacket } from "mysql2/promise"

export const PROJECT_ITEM_TYPES = ["Phase", "Activity"] as const
export type ProjectItemType = (typeof PROJECT_ITEM_TYPES)[number]

export function isProjectItemType(value: string): value is ProjectItemType {
  return (PROJECT_ITEM_TYPES as readonly string[]).includes(value)
}

export const PROJECT_ITEM_STATUSES = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Completed",
] as const
export type ProjectItemStatus = (typeof PROJECT_ITEM_STATUSES)[number]

export function isProjectItemStatus(value: string): value is ProjectItemStatus {
  return (PROJECT_ITEM_STATUSES as readonly string[]).includes(value)
}

export const COMPLETED_STATUS: ProjectItemStatus = "Completed"

export type ProjectItemRow = RowDataPacket & {
  id: string
  project_id: string
  parent_item_id: string | null
  item_type: ProjectItemType
  name: string
  description: string | null
  status: ProjectItemStatus
  assigned_user_id: string | null
  start_date: string | null
  due_date: string | null
  sort_order: number
  completed_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  assigned_user_name: string | null
  created_by_name: string | null
  deleted_by_name: string | null
  parent_deleted_at: string | null
}

/**
 * Base select for project items. `parent_deleted_at` is joined in because soft
 * delete is not cascaded: an item is effectively deleted when its own or its
 * parent's `deleted_at` is set.
 */
export const projectItemSelectSql = `
  SELECT
    project_items.id,
    project_items.project_id,
    project_items.parent_item_id,
    project_items.item_type,
    project_items.name,
    project_items.description,
    project_items.status,
    project_items.assigned_user_id,
    project_items.start_date,
    project_items.due_date,
    project_items.sort_order,
    project_items.completed_at,
    project_items.deleted_at,
    project_items.created_at,
    project_items.updated_at,
    assigned_user.name AS assigned_user_name,
    created_by.name AS created_by_name,
    deleted_by.name AS deleted_by_name,
    parent_item.deleted_at AS parent_deleted_at
  FROM project_items
  LEFT JOIN users AS assigned_user
    ON assigned_user.id = project_items.assigned_user_id
  LEFT JOIN users AS created_by
    ON created_by.id = project_items.created_by_user_id
  LEFT JOIN users AS deleted_by
    ON deleted_by.id = project_items.deleted_by_user_id
  LEFT JOIN project_items AS parent_item
    ON parent_item.id = project_items.parent_item_id
`

export type MappedProjectItem = {
  id: string
  projectId: string
  parentItemId: string | null
  itemType: ProjectItemType
  name: string
  description: string | null
  status: ProjectItemStatus
  assignedUserId: string | null
  assignedUserName: string | null
  startDate: string | null
  dueDate: string | null
  sortOrder: number
  completedAt: string | null
  /** Set when this item itself was soft-deleted. */
  deletedAt: string | null
  deletedByName: string | null
  /**
   * True when the item, or the phase it belongs to, is soft-deleted. This is the
   * flag the UI hides on — an activity under a deleted phase is gone from default
   * views even though its own `deletedAt` is null.
   */
  effectivelyDeleted: boolean
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export function mapProjectItem(row: ProjectItemRow): MappedProjectItem {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    parentItemId: row.parent_item_id ? String(row.parent_item_id) : null,
    itemType: row.item_type,
    name: row.name,
    description: row.description,
    status: row.status,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    assignedUserName: row.assigned_user_name,
    startDate: row.start_date,
    dueDate: row.due_date,
    sortOrder: Number(row.sort_order ?? 0),
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
    deletedByName: row.deleted_by_name,
    effectivelyDeleted: row.deleted_at !== null || row.parent_deleted_at !== null,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Minimal item shape the pure tree/status helpers below operate on. */
export type ItemNode = {
  id: string
  parentItemId: string | null
  itemType: ProjectItemType
  name: string
  status: ProjectItemStatus
  sortOrder: number
  effectivelyDeleted: boolean
}

export type ProjectItemTreeNode<T extends ItemNode> = T & { activities: T[] }

/**
 * Groups a flat item list into phases with their child activities, ordered by
 * `sortOrder` then name. Activities whose parent is missing from the input (for
 * example a filtered query) are dropped rather than silently promoted to phases —
 * an orphan activity is never a valid phase.
 */
export function buildItemTree<T extends ItemNode>(
  items: readonly T[]
): ProjectItemTreeNode<T>[] {
  const compare = (a: T, b: T): number =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)

  const phases = items
    .filter((item) => item.itemType === "Phase")
    .sort(compare)
    .map((phase) => ({ ...phase, activities: [] as T[] }))

  const byId = new Map(phases.map((phase) => [phase.id, phase]))

  for (const item of items) {
    if (item.itemType !== "Activity" || !item.parentItemId) {
      continue
    }
    byId.get(item.parentItemId)?.activities.push(item)
  }

  for (const phase of phases) {
    phase.activities.sort(compare)
  }

  return phases
}

/**
 * Live child activities of a phase that are not yet Completed. Drives the
 * "completing a phase with unfinished activities" confirmation — deleted children
 * are excluded, since they are no longer work anyone has to finish.
 */
export function findIncompleteChildren<T extends ItemNode>(
  items: readonly T[],
  phaseId: string
): T[] {
  return items.filter(
    (item) =>
      item.itemType === "Activity" &&
      item.parentItemId === phaseId &&
      !item.effectivelyDeleted &&
      item.status !== COMPLETED_STATUS
  )
}

export type ProjectItemInput = {
  itemType: ProjectItemType
  parentItemId: number | null
  name: string
  description: string | null
  status: ProjectItemStatus
  assignedUserId: number | null
  startDate: string | null
  dueDate: string | null
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseOptionalIsoDate(
  value: unknown
): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null }
  }
  if (typeof value !== "string") {
    return { ok: false }
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: true, value: null }
  }
  if (
    !ISO_DATE_PATTERN.test(trimmed) ||
    Number.isNaN(new Date(`${trimmed}T00:00:00Z`).getTime())
  ) {
    return { ok: false }
  }
  return { ok: true, value: trimmed }
}

function parseOptionalId(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null }
  }
  const raw = typeof value === "number" ? String(value) : value
  if (typeof raw !== "string") {
    return { ok: false }
  }
  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false }
  }
  return { ok: true, value: parsed }
}

/**
 * Validates a create/update payload for a phase or activity. Pure, so the shape
 * invariant (a Phase has no parent, an Activity must have one) is checked
 * identically on both paths and is unit-testable without a database.
 */
export function validateItemInput(
  payload: unknown
): { ok: true; value: ProjectItemInput } | { ok: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Invalid request body." }
  }
  const body = payload as Record<string, unknown>

  const rawType = typeof body.itemType === "string" ? body.itemType : ""
  if (!isProjectItemType(rawType)) {
    return { ok: false, error: "Item type must be Phase or Activity." }
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return { ok: false, error: "Name is required." }
  }
  if (name.length > 200) {
    return { ok: false, error: "Name must be 200 characters or fewer." }
  }

  const parent = parseOptionalId(body.parentItemId)
  if (!parent.ok) {
    return { ok: false, error: "Invalid parent id." }
  }
  if (rawType === "Phase" && parent.value !== null) {
    return { ok: false, error: "A phase cannot have a parent." }
  }
  if (rawType === "Activity" && parent.value === null) {
    return { ok: false, error: "An activity must belong to a phase." }
  }

  const rawStatus = typeof body.status === "string" ? body.status : "Not Started"
  if (!isProjectItemStatus(rawStatus)) {
    return { ok: false, error: "Unknown status." }
  }

  const assigned = parseOptionalId(body.assignedUserId)
  if (!assigned.ok) {
    return { ok: false, error: "Invalid assigned user id." }
  }

  const startDate = parseOptionalIsoDate(body.startDate)
  if (!startDate.ok) {
    return { ok: false, error: "Start date must be a valid YYYY-MM-DD date." }
  }
  const dueDate = parseOptionalIsoDate(body.dueDate)
  if (!dueDate.ok) {
    return { ok: false, error: "Due date must be a valid YYYY-MM-DD date." }
  }
  if (
    startDate.value &&
    dueDate.value &&
    dueDate.value < startDate.value
  ) {
    return { ok: false, error: "Due date cannot be before the start date." }
  }

  const rawDescription =
    typeof body.description === "string" ? body.description.trim() : ""

  return {
    ok: true,
    value: {
      itemType: rawType,
      parentItemId: parent.value,
      name,
      description: rawDescription ? rawDescription : null,
      status: rawStatus,
      assignedUserId: assigned.value,
      startDate: startDate.value,
      dueDate: dueDate.value,
    },
  }
}

/**
 * The hierarchy is exactly two levels deep. A prospective parent is valid only if
 * it is a Phase — which, given `chk_project_items_shape`, is the same as saying it
 * has no parent of its own.
 */
export function isValidActivityParent(
  parent: { itemType: ProjectItemType; parentItemId: string | null } | null
): boolean {
  if (!parent) {
    return false
  }
  return parent.itemType === "Phase" && parent.parentItemId === null
}
