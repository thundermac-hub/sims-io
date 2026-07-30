import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import { mapProject, projectSelectSql, validateProjectInput } from "@/lib/projects"
import type { ProjectRow } from "@/lib/projects"

import { requireProjectAccess } from "../helpers"

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

  const [rows] = await queryWithReconnect<ProjectRow[]>(
    `${projectSelectSql} WHERE projects.id = ? LIMIT 1`,
    [access.projectId]
  )
  const row = rows[0]
  if (!row) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  return NextResponse.json({
    project: mapProject(row),
    // Effective role drives every affordance in the UI. `SuperAdminReadOnly`
    // renders the same as a Viewer but without the comment composer.
    role: access.role,
  })
}

export async function PATCH(
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

  const validated = validateProjectInput(payload)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  const { name, description, startDate } = validated.value

  await queryWithReconnect(
    `UPDATE projects SET name = ?, description = ?, start_date = ? WHERE id = ?`,
    [name, description, startDate, access.projectId]
  )

  const [rows] = await queryWithReconnect<ProjectRow[]>(
    `${projectSelectSql} WHERE projects.id = ? LIMIT 1`,
    [access.projectId]
  )
  const row = rows[0]
  if (!row) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  return NextResponse.json({ project: mapProject(row), role: access.role })
}
