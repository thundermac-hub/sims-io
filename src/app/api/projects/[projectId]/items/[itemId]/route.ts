import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"
import {
  findIncompleteChildren,
  isProjectItemStatus,
  mapProjectItem,
  projectItemSelectSql,
  validateItemInput,
} from "@/lib/project-items"
import type { MappedProjectItem, ProjectItemRow } from "@/lib/project-items"

import {
  loadProjectItems,
  parseProjectId,
  requireProjectAccess,
} from "../../../helpers"

type RouteContext = {
  params: Promise<{ projectId: string; itemId: string }>
}

async function loadItem(
  projectId: number,
  itemId: number
): Promise<MappedProjectItem | null> {
  const [rows] = await queryWithReconnect<ProjectItemRow[]>(
    `${projectItemSelectSql}
     WHERE project_items.id = ? AND project_items.project_id = ? LIMIT 1`,
    [itemId, projectId]
  )
  const row = rows[0]
  return row ? mapProjectItem(row) : null
}

/**
 * Updates an item. Three distinct operations share this handler because they all
 * mutate the same row:
 *   - `{ restore: true }`            — undo a soft delete
 *   - `{ status }` alone             — status-only change (the common case)
 *   - a full item payload            — edit name/description/dates/assignee
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId, itemId: rawItemId } = await params
  const access = await requireProjectAccess(request, projectId, "edit")
  if ("response" in access) {
    return access.response
  }
  const itemId = parseProjectId(rawItemId)
  if (itemId === null) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }
  const body = (payload ?? {}) as Record<string, unknown>

  const existing = await loadItem(access.projectId, itemId)
  if (!existing) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 })
  }

  // --- Restore -------------------------------------------------------------
  if (body.restore === true) {
    if (existing.deletedAt === null) {
      return NextResponse.json(
        { error: "That item is not deleted." },
        { status: 409 }
      )
    }
    // An activity cannot be live under a deleted phase, so the phase must come
    // back first. Restoring a phase implicitly restores every child that was not
    // deleted in its own right — soft delete is never cascaded.
    if (existing.parentItemId !== null) {
      const [parentRows] = await queryWithReconnect<
        Array<RowDataPacket & { deleted_at: string | null }>
      >(`SELECT deleted_at FROM project_items WHERE id = ? LIMIT 1`, [
        existing.parentItemId,
      ])
      if (parentRows[0]?.deleted_at !== null) {
        return NextResponse.json(
          { error: "Restore the phase first, then this activity." },
          { status: 409 }
        )
      }
    }

    await queryWithReconnect(
      `UPDATE project_items
       SET deleted_at = NULL, deleted_by_user_id = NULL
       WHERE id = ? AND project_id = ?`,
      [itemId, access.projectId]
    )
    return NextResponse.json({ item: await loadItem(access.projectId, itemId) })
  }

  if (existing.effectivelyDeleted) {
    return NextResponse.json(
      { error: "Restore this item before editing it." },
      { status: 409 }
    )
  }

  // --- Status-only change --------------------------------------------------
  const isStatusOnly =
    typeof body.status === "string" && body.itemType === undefined

  if (isStatusOnly) {
    const status = body.status as string
    if (!isProjectItemStatus(status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 })
    }
    if (status === existing.status) {
      // No-op: report it so the caller (and the notification layer) can skip work.
      return NextResponse.json({ item: existing, changed: false })
    }

    // Completing a phase whose activities are unfinished needs an explicit
    // confirmation. This is enforced here, not only in the modal — the API is a
    // public surface and a client-side dialog is not an authorisation boundary.
    if (status === "Completed" && existing.itemType === "Phase") {
      const items = await loadProjectItems(access.projectId)
      const incomplete = findIncompleteChildren(items, existing.id)
      if (incomplete.length > 0 && body.confirmIncompleteChildren !== true) {
        return NextResponse.json(
          {
            requiresConfirmation: true,
            reason: "incompleteChildren",
            incompleteCount: incomplete.length,
            incompleteNames: incomplete.map((item) => item.name),
            error: `${incomplete.length} activit${
              incomplete.length === 1 ? "y is" : "ies are"
            } not yet completed.`,
          },
          { status: 409 }
        )
      }
    }

    await queryWithReconnect(
      `UPDATE project_items
       SET status = ?, completed_at = ${status === "Completed" ? "NOW(3)" : "NULL"}
       WHERE id = ? AND project_id = ?`,
      [status, itemId, access.projectId]
    )
    return NextResponse.json({
      item: await loadItem(access.projectId, itemId),
      changed: true,
      previousStatus: existing.status,
    })
  }

  // --- Full edit -----------------------------------------------------------
  const validated = validateItemInput({
    ...body,
    // The type and parent of an existing item are immutable: moving an activity
    // between phases would silently invalidate its dependencies.
    itemType: existing.itemType,
    parentItemId: existing.parentItemId,
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  const input = validated.value

  if (input.assignedUserId !== null) {
    const [memberRows] = await queryWithReconnect<
      Array<RowDataPacket & { user_id: string }>
    >(
      `SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
      [access.projectId, input.assignedUserId]
    )
    if (!memberRows[0]) {
      return NextResponse.json(
        { error: "Only project members can be assigned to an item." },
        { status: 400 }
      )
    }
  }

  if (
    input.status === "Completed" &&
    existing.itemType === "Phase" &&
    existing.status !== "Completed"
  ) {
    const items = await loadProjectItems(access.projectId)
    const incomplete = findIncompleteChildren(items, existing.id)
    if (incomplete.length > 0 && body.confirmIncompleteChildren !== true) {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          reason: "incompleteChildren",
          incompleteCount: incomplete.length,
          incompleteNames: incomplete.map((item) => item.name),
          error: `${incomplete.length} activit${
            incomplete.length === 1 ? "y is" : "ies are"
          } not yet completed.`,
        },
        { status: 409 }
      )
    }
  }

  await queryWithReconnect(
    `UPDATE project_items
     SET name = ?, description = ?, status = ?, assigned_user_id = ?,
         start_date = ?, due_date = ?,
         completed_at = ${
           input.status === "Completed"
             ? "COALESCE(completed_at, NOW(3))"
             : "NULL"
         }
     WHERE id = ? AND project_id = ?`,
    [
      input.name,
      input.description,
      input.status,
      input.assignedUserId,
      input.startDate,
      input.dueDate,
      itemId,
      access.projectId,
    ]
  )

  return NextResponse.json({
    item: await loadItem(access.projectId, itemId),
    changed: true,
    previousStatus: existing.status,
  })
}

/**
 * Soft-deletes an item: the row stays, with its comments and history, and can be
 * restored. Children are not touched — an activity under a deleted phase is
 * effectively deleted via the parent, which is what makes restore lossless.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId, itemId: rawItemId } = await params
  const access = await requireProjectAccess(request, projectId, "edit")
  if ("response" in access) {
    return access.response
  }
  const itemId = parseProjectId(rawItemId)
  if (itemId === null) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 })
  }

  const existing = await loadItem(access.projectId, itemId)
  if (!existing) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 })
  }
  if (existing.deletedAt !== null) {
    return NextResponse.json(
      { error: "That item is already deleted." },
      { status: 409 }
    )
  }

  // Warn before deleting something other live items are waiting on. Per PRD §5
  // the dependents keep the reference and keep showing it as unmet until it is
  // updated or the item is restored, so the Owner/Editor has to opt in.
  const confirmed = request.nextUrl.searchParams.get("confirmDependents") === "1"
  if (!confirmed) {
    const [dependentRows] = await queryWithReconnect<
      Array<RowDataPacket & { name: string }>
    >(
      `SELECT dependent.name
       FROM project_item_dependencies AS dep
       JOIN project_items AS dependent ON dependent.id = dep.item_id
       LEFT JOIN project_items AS dependent_parent
         ON dependent_parent.id = dependent.parent_item_id
       WHERE dep.depends_on_item_id = ?
         AND dependent.deleted_at IS NULL
         AND (dependent_parent.id IS NULL OR dependent_parent.deleted_at IS NULL)`,
      [itemId]
    )
    if (dependentRows.length > 0) {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          reason: "hasDependents",
          dependentNames: dependentRows.map((row) => row.name),
          error: `${dependentRows.length} item${
            dependentRows.length === 1 ? "" : "s"
          } depend on this and will show an unmet dependency.`,
        },
        { status: 409 }
      )
    }
  }

  await queryWithReconnect(
    `UPDATE project_items
     SET deleted_at = NOW(3), deleted_by_user_id = ?
     WHERE id = ? AND project_id = ?`,
    [access.user.id, itemId, access.projectId]
  )

  return NextResponse.json({ item: await loadItem(access.projectId, itemId) })
}
