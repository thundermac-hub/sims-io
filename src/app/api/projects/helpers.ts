import { NextRequest, NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth"
import getPool, { queryWithReconnect } from "@/lib/db"
import { hasPageAccessForPath } from "@/lib/page-access"
import { mapProjectItem, projectItemSelectSql } from "@/lib/project-items"
import type { MappedProjectItem, ProjectItemRow } from "@/lib/project-items"
import {
  canCommentOnProject,
  canEditProject,
  canManageMembers,
  canTransferOwnership,
  canViewProject,
  isProjectRole,
  resolveEffectiveRole,
} from "@/lib/projects"
import type {
  EffectiveProjectRole,
  ProjectAuthUser,
  ProjectRole,
} from "@/lib/projects"
import type { PoolConnection, RowDataPacket } from "mysql2/promise"

export const PROJECTS_ACCESS_PATH = "/projects"

/**
 * Resolves the authenticated user and enforces access to the Project Tracker
 * module. Mirrors `resolveLeadsUser` in the leads helpers, gating on the
 * `/projects` access key (Super Admin bypasses the module gate).
 *
 * Note this is only the *module* gate — it says nothing about which projects the
 * user can see. Per-project access is `project_members`, resolved by
 * `requireProjectAccess`.
 */
export async function resolveProjectsUser(
  request: NextRequest
): Promise<{ user: ProjectAuthUser } | { response: NextResponse }> {
  const user = await requireAuthenticatedUser(request)
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    }
  }

  const authUser: ProjectAuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    pageAccess: user.pageAccess,
  }

  const hasAccess = hasPageAccessForPath(PROJECTS_ACCESS_PATH, authUser.pageAccess)
  if (authUser.role !== "Super Admin" && !hasAccess) {
    return {
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    }
  }

  return { user: authUser }
}

export function parseProjectId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function parseUserId(value: unknown): number | null {
  const cleaned =
    typeof value === "number" ? String(value) : cleanString(value)
  if (!cleaned) {
    return null
  }
  const parsed = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

/** Returns the caller's `project_members.role`, or null if they hold none. */
export async function loadProjectMembership(
  projectId: number,
  userId: string
): Promise<ProjectRole | null> {
  const [rows] = await queryWithReconnect<Array<RowDataPacket & { role: string }>>(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [projectId, userId]
  )
  const role = rows[0]?.role
  if (!role || !isProjectRole(role)) {
    return null
  }
  return role
}

/**
 * Loads every item on a project, including soft-deleted ones. Callers filter on
 * `effectivelyDeleted` — the deleted view, the completion check, and the
 * dependency graph all need the full set, so the query never filters.
 */
export async function loadProjectItems(
  projectId: number
): Promise<MappedProjectItem[]> {
  const [rows] = await queryWithReconnect<ProjectItemRow[]>(
    `${projectItemSelectSql}
     WHERE project_items.project_id = ?
     ORDER BY project_items.sort_order ASC, project_items.name ASC`,
    [projectId]
  )
  return rows.map(mapProjectItem)
}

export type ProjectCapability = "view" | "comment" | "edit" | "manageMembers" | "transferOwnership"

const CAPABILITY_CHECKS: Record<
  ProjectCapability,
  (role: EffectiveProjectRole | null) => boolean
> = {
  view: canViewProject,
  comment: canCommentOnProject,
  edit: canEditProject,
  manageMembers: canManageMembers,
  transferOwnership: canTransferOwnership,
}

export type ProjectAccess = {
  user: ProjectAuthUser
  projectId: number
  projectName: string
  role: EffectiveProjectRole
}

/**
 * The single authorisation entry point for every project-scoped route: resolves
 * the module gate, the project row, and the caller's effective role, then checks
 * the requested capability.
 *
 * Deliberate response codes:
 *  - unknown project, or a caller with no effective role  → 404 (never leak that
 *    a project exists to someone who cannot see it)
 *  - visible project but insufficient capability          → 403
 */
export async function requireProjectAccess(
  request: NextRequest,
  rawProjectId: string,
  capability: ProjectCapability
): Promise<ProjectAccess | { response: NextResponse }> {
  const auth = await resolveProjectsUser(request)
  if ("response" in auth) {
    return auth
  }

  const projectId = parseProjectId(rawProjectId)
  if (projectId === null) {
    return {
      response: NextResponse.json({ error: "Invalid project id." }, { status: 400 }),
    }
  }

  const [projectRows] = await queryWithReconnect<
    Array<RowDataPacket & { id: string; name: string }>
  >(`SELECT id, name FROM projects WHERE id = ? LIMIT 1`, [projectId])
  const project = projectRows[0]
  if (!project) {
    return {
      response: NextResponse.json({ error: "Project not found." }, { status: 404 }),
    }
  }

  const membership = await loadProjectMembership(projectId, auth.user.id)
  const role = resolveEffectiveRole(membership, auth.user.role)
  if (!role || !canViewProject(role)) {
    return {
      response: NextResponse.json({ error: "Project not found." }, { status: 404 }),
    }
  }

  if (!CAPABILITY_CHECKS[capability](role)) {
    return {
      response: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 }
      ),
    }
  }

  return { user: auth.user, projectId, projectName: project.name, role }
}

/**
 * Runs `work` inside a transaction that first takes a row lock on the project.
 * The project row doubles as a per-project mutex, which is what makes the
 * dependency cycle check and the ownership transfer safe against concurrent
 * writes that would each pass validation in isolation.
 */
export async function withProjectLock<T>(
  projectId: number,
  work: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.query(`SELECT id FROM projects WHERE id = ? FOR UPDATE`, [
      projectId,
    ])
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
