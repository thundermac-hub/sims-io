import { NextRequest, NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"
import {
  isValidActivityParent,
  mapProjectItem,
  projectItemSelectSql,
  validateItemInput,
} from "@/lib/project-items"
import type { ProjectItemRow } from "@/lib/project-items"

import { loadProjectItems, requireProjectAccess } from "../../helpers"

type RouteContext = { params: Promise<{ projectId: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "view")
  if ("response" in access) {
    return access.response
  }

  const includeDeleted =
    request.nextUrl.searchParams.get("includeDeleted") === "1"
  const items = await loadProjectItems(access.projectId)

  return NextResponse.json({
    items: includeDeleted
      ? items
      : items.filter((item) => !item.effectivelyDeleted),
  })
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "edit")
  if ("response" in access) {
    return access.response
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const validated = validateItemInput(payload)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  const input = validated.value

  // An activity's parent must be a live phase on *this* project. The composite
  // (id, project_id) lookup is what keeps items from being grafted across
  // projects.
  if (input.parentItemId !== null) {
    const [parentRows] = await queryWithReconnect<
      Array<
        RowDataPacket & {
          id: string
          item_type: "Phase" | "Activity"
          parent_item_id: string | null
          deleted_at: string | null
        }
      >
    >(
      `SELECT id, item_type, parent_item_id, deleted_at
       FROM project_items
       WHERE id = ? AND project_id = ? LIMIT 1`,
      [input.parentItemId, access.projectId]
    )
    const parent = parentRows[0]
    if (!parent) {
      return NextResponse.json(
        { error: "Parent phase not found on this project." },
        { status: 404 }
      )
    }
    if (parent.deleted_at !== null) {
      return NextResponse.json(
        { error: "Cannot add an activity to a deleted phase." },
        { status: 409 }
      )
    }
    if (
      !isValidActivityParent({
        itemType: parent.item_type,
        parentItemId: parent.parent_item_id,
      })
    ) {
      return NextResponse.json(
        { error: "Activities can only be added under a phase." },
        { status: 400 }
      )
    }
  }

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

  // New items go last within their level.
  const [orderRows] = await queryWithReconnect<
    Array<RowDataPacket & { next_order: number | null }>
  >(
    `SELECT MAX(sort_order) + 1 AS next_order
     FROM project_items
     WHERE project_id = ? AND ${
       input.parentItemId === null
         ? "parent_item_id IS NULL"
         : "parent_item_id = ?"
     }`,
    input.parentItemId === null
      ? [access.projectId]
      : [access.projectId, input.parentItemId]
  )
  const sortOrder = Number(orderRows[0]?.next_order ?? 0)

  const [result] = await queryWithReconnect<ResultSetHeader>(
    `INSERT INTO project_items (
       project_id, parent_item_id, item_type, name, description, status,
       assigned_user_id, start_date, due_date, sort_order, completed_at,
       created_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      access.projectId,
      input.parentItemId,
      input.itemType,
      input.name,
      input.description,
      input.status,
      input.assignedUserId,
      input.startDate,
      input.dueDate,
      sortOrder,
      input.status === "Completed" ? new Date() : null,
      access.user.id,
    ]
  )

  const [rows] = await queryWithReconnect<ProjectItemRow[]>(
    `${projectItemSelectSql} WHERE project_items.id = ? LIMIT 1`,
    [result.insertId]
  )
  const row = rows[0]
  if (!row) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 })
  }

  return NextResponse.json({ item: mapProjectItem(row) }, { status: 201 })
}
