import { NextRequest, NextResponse } from "next/server"
import type { ResultSetHeader } from "mysql2/promise"

import getPool, { queryWithReconnect } from "@/lib/db"
import {
  mapProject,
  projectSelectSql,
  validateProjectInput,
} from "@/lib/projects"
import type { ProjectRow } from "@/lib/projects"

import { resolveProjectsUser } from "./helpers"

/**
 * Lists the projects the caller can see: their own memberships, or every project
 * for a Super Admin (read-only visibility — see `resolveEffectiveRole`).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await resolveProjectsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const isSuperAdmin = auth.user.role === "Super Admin"
  const values: Array<string | number> = []
  let scopeClause = ""
  if (!isSuperAdmin) {
    scopeClause = `
      WHERE EXISTS (
        SELECT 1 FROM project_members AS scope
        WHERE scope.project_id = projects.id AND scope.user_id = ?
      )
    `
    values.push(auth.user.id)
  }

  const [rows] = await queryWithReconnect<ProjectRow[]>(
    `${projectSelectSql} ${scopeClause} ORDER BY projects.created_at DESC`,
    values
  )

  const [roleRows] = await queryWithReconnect<
    Array<{ project_id: string; role: string }>
  >(`SELECT project_id, role FROM project_members WHERE user_id = ?`, [
    auth.user.id,
  ])
  const roleByProjectId = new Map(
    roleRows.map((row) => [String(row.project_id), row.role])
  )

  return NextResponse.json({
    projects: rows.map((row) => {
      const project = mapProject(row)
      return {
        ...project,
        // The caller's own role, so the list can show it without an extra fetch.
        // Null for a Super Admin viewing a project they are not a member of.
        myRole: roleByProjectId.get(project.id) ?? null,
      }
    }),
  })
}

/**
 * Creates a project and its Owner membership row in one transaction — a project
 * must never exist without an Owner.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await resolveProjectsUser(request)
  if ("response" in auth) {
    return auth.response
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

  const connection = await getPool().getConnection()
  let projectId: number
  try {
    await connection.beginTransaction()
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO projects (name, description, start_date, created_by_user_id)
       VALUES (?, ?, ?, ?)`,
      [name, description, startDate, auth.user.id]
    )
    projectId = result.insertId
    await connection.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Owner')`,
      [projectId, auth.user.id]
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const [rows] = await queryWithReconnect<ProjectRow[]>(
    `${projectSelectSql} WHERE projects.id = ? LIMIT 1`,
    [projectId]
  )
  const row = rows[0]
  if (!row) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  return NextResponse.json(
    { project: { ...mapProject(row), myRole: "Owner" } },
    { status: 201 }
  )
}
