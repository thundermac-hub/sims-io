import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"
import {
  isAssignableProjectRole,
  mapProjectMember,
  projectMemberSelectSql,
} from "@/lib/projects"
import type { MappedProjectMember, ProjectMemberRow } from "@/lib/projects"

import { parseUserId, requireProjectAccess } from "../../helpers"

type RouteContext = { params: Promise<{ projectId: string }> }

async function loadMembers(projectId: number): Promise<MappedProjectMember[]> {
  const [rows] = await queryWithReconnect<ProjectMemberRow[]>(
    `${projectMemberSelectSql}
     WHERE project_members.project_id = ?
     ORDER BY FIELD(project_members.role, 'Owner', 'Editor', 'Viewer'), member_user.name ASC`,
    [projectId]
  )
  return rows.map(mapProjectMember)
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "view")
  if ("response" in access) {
    return access.response
  }
  return NextResponse.json({ members: await loadMembers(access.projectId) })
}

/** Adds a user to the project as an Editor or Viewer. */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "manageMembers")
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

  const userId = parseUserId(body.userId)
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 })
  }
  const role = typeof body.role === "string" ? body.role : ""
  if (!isAssignableProjectRole(role)) {
    return NextResponse.json(
      { error: "Role must be Editor or Viewer." },
      { status: 400 }
    )
  }

  const [userRows] = await queryWithReconnect<Array<RowDataPacket & { id: string }>>(
    `SELECT id FROM users WHERE id = ? AND status = 'active' AND is_active = TRUE LIMIT 1`,
    [userId]
  )
  if (!userRows[0]) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  // Idempotent add: re-adding an existing member updates their role instead of
  // failing on the (project_id, user_id) unique key. The Owner row is protected
  // so a stray add can never demote the Owner.
  await queryWithReconnect(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role = IF(role = 'Owner', 'Owner', VALUES(role))`,
    [access.projectId, userId, role]
  )

  return NextResponse.json(
    { members: await loadMembers(access.projectId) },
    { status: 201 }
  )
}

/** Changes an existing member's role. Cannot touch the Owner row. */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "manageMembers")
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

  const userId = parseUserId(body.userId)
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 })
  }
  const role = typeof body.role === "string" ? body.role : ""
  if (!isAssignableProjectRole(role)) {
    return NextResponse.json(
      { error: "Role must be Editor or Viewer." },
      { status: 400 }
    )
  }

  const [existing] = await queryWithReconnect<
    Array<RowDataPacket & { role: string }>
  >(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [access.projectId, userId]
  )
  const current = existing[0]
  if (!current) {
    return NextResponse.json(
      { error: "That user is not a member of this project." },
      { status: 404 }
    )
  }
  if (current.role === "Owner") {
    return NextResponse.json(
      {
        error:
          "The Project Owner's role cannot be changed here. Use Transfer ownership instead.",
      },
      { status: 400 }
    )
  }

  await queryWithReconnect(
    `UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`,
    [role, access.projectId, userId]
  )

  return NextResponse.json({ members: await loadMembers(access.projectId) })
}

/** Revokes a member's access. Cannot remove the Owner. */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "manageMembers")
  if ("response" in access) {
    return access.response
  }

  const userId = parseUserId(request.nextUrl.searchParams.get("userId"))
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 })
  }

  const [existing] = await queryWithReconnect<
    Array<RowDataPacket & { role: string }>
  >(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [access.projectId, userId]
  )
  const current = existing[0]
  if (!current) {
    return NextResponse.json(
      { error: "That user is not a member of this project." },
      { status: 404 }
    )
  }
  if (current.role === "Owner") {
    return NextResponse.json(
      {
        error:
          "The Project Owner cannot be removed. Transfer ownership first.",
      },
      { status: 400 }
    )
  }

  await queryWithReconnect(
    `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
    [access.projectId, userId]
  )

  return NextResponse.json({ members: await loadMembers(access.projectId) })
}
