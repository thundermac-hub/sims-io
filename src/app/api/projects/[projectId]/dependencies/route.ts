import { NextRequest, NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"
import {
  DEPENDENCY_CONFLICT_MESSAGE,
  findDependencyConflict,
  mapDependency,
} from "@/lib/project-dependencies"
import type { DependencyEdge, DependencyRow } from "@/lib/project-dependencies"

import {
  parseProjectId,
  requireProjectAccess,
  withProjectLock,
} from "../../helpers"

type RouteContext = { params: Promise<{ projectId: string }> }

const DEPENDENCY_SELECT_SQL = `
  SELECT id, item_id, depends_on_item_id, created_at
  FROM project_item_dependencies
  WHERE project_id = ?
  ORDER BY id ASC
`

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "view")
  if ("response" in access) {
    return access.response
  }

  const [rows] = await queryWithReconnect<DependencyRow[]>(
    DEPENDENCY_SELECT_SQL,
    [access.projectId]
  )
  return NextResponse.json({ dependencies: rows.map(mapDependency) })
}

/**
 * Adds a finish-to-start dependency. The validation runs inside the project row
 * lock: two concurrent requests could each be acyclic on their own yet close a
 * loop together, so the check and the insert have to be one atomic step.
 */
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
  const body = (payload ?? {}) as Record<string, unknown>

  const itemId = parseProjectId(String(body.itemId ?? ""))
  const dependsOnItemId = parseProjectId(String(body.dependsOnItemId ?? ""))
  if (itemId === null || dependsOnItemId === null) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 })
  }

  const outcome = await withProjectLock(access.projectId, async (connection) => {
    // Both endpoints must be live items on this project. The composite FK would
    // also reject a cross-project reference, but checking here gives a usable
    // error instead of a constraint violation.
    const [itemRows] = await connection.query<
      Array<
        RowDataPacket & {
          id: string
          parent_item_id: string | null
          name: string
          deleted_at: string | null
          parent_deleted_at: string | null
        }
      >
    >(
      `SELECT child.id, child.parent_item_id, child.name, child.deleted_at,
              parent.deleted_at AS parent_deleted_at
       FROM project_items AS child
       LEFT JOIN project_items AS parent ON parent.id = child.parent_item_id
       WHERE child.project_id = ? AND child.id IN (?, ?)`,
      [access.projectId, itemId, dependsOnItemId]
    )
    if (itemRows.length !== 2) {
      return {
        status: 404,
        body: { error: "Both items must exist on this project." },
      }
    }
    const deleted = itemRows.find(
      (row) => row.deleted_at !== null || row.parent_deleted_at !== null
    )
    if (deleted) {
      return {
        status: 409,
        body: { error: `"${deleted.name}" is deleted; restore it first.` },
      }
    }

    // Parent map for the ancestor check — a phase and its own activity can never
    // depend on each other.
    const [parentRows] = await connection.query<
      Array<RowDataPacket & { id: string; parent_item_id: string | null }>
    >(`SELECT id, parent_item_id FROM project_items WHERE project_id = ?`, [
      access.projectId,
    ])
    const parentByItemId = new Map<string, string | null>(
      parentRows.map((row) => [
        String(row.id),
        row.parent_item_id ? String(row.parent_item_id) : null,
      ])
    )

    const [edgeRows] = await connection.query<
      Array<RowDataPacket & { item_id: string; depends_on_item_id: string }>
    >(
      `SELECT item_id, depends_on_item_id
       FROM project_item_dependencies WHERE project_id = ?`,
      [access.projectId]
    )
    const edges: DependencyEdge[] = edgeRows.map((row) => ({
      itemId: String(row.item_id),
      dependsOnItemId: String(row.depends_on_item_id),
    }))

    const conflict = findDependencyConflict(
      edges,
      parentByItemId,
      String(itemId),
      String(dependsOnItemId)
    )
    if (conflict) {
      return {
        status: 409,
        body: { error: DEPENDENCY_CONFLICT_MESSAGE[conflict], conflict },
      }
    }

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO project_item_dependencies
         (project_id, item_id, depends_on_item_id, created_by_user_id)
       VALUES (?, ?, ?, ?)`,
      [access.projectId, itemId, dependsOnItemId, access.user.id]
    )
    return { status: 201, body: { id: String(result.insertId) } }
  })

  if (outcome.status !== 201) {
    return NextResponse.json(outcome.body, { status: outcome.status })
  }

  const [rows] = await queryWithReconnect<DependencyRow[]>(
    DEPENDENCY_SELECT_SQL,
    [access.projectId]
  )
  return NextResponse.json(
    { dependencies: rows.map(mapDependency) },
    { status: 201 }
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "edit")
  if ("response" in access) {
    return access.response
  }

  const dependencyId = parseProjectId(
    request.nextUrl.searchParams.get("dependencyId") ?? ""
  )
  if (dependencyId === null) {
    return NextResponse.json({ error: "Invalid dependency id." }, { status: 400 })
  }

  const [result] = await queryWithReconnect<ResultSetHeader>(
    `DELETE FROM project_item_dependencies WHERE id = ? AND project_id = ?`,
    [dependencyId, access.projectId]
  )
  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "Dependency not found." }, { status: 404 })
  }

  const [rows] = await queryWithReconnect<DependencyRow[]>(
    DEPENDENCY_SELECT_SQL,
    [access.projectId]
  )
  return NextResponse.json({ dependencies: rows.map(mapDependency) })
}
