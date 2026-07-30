import type { RowDataPacket } from "mysql2/promise"

export const PROJECT_ROLES = ["Owner", "Editor", "Viewer"] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]

export function isProjectRole(value: string): value is ProjectRole {
  return (PROJECT_ROLES as readonly string[]).includes(value)
}

/**
 * Roles that may be handed out through the members panel. Ownership is not
 * assignable directly — it is established on project creation and moved only via
 * the transfer-ownership flow.
 */
export const ASSIGNABLE_PROJECT_ROLES = ["Editor", "Viewer"] as const
export type AssignableProjectRole = (typeof ASSIGNABLE_PROJECT_ROLES)[number]

export function isAssignableProjectRole(
  value: string
): value is AssignableProjectRole {
  return (ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(value)
}

/**
 * Minimal shape of the authenticated user needed for project authorisation.
 * Mirrors `LeadAuthUser` in `src/lib/leads.ts`.
 */
export type ProjectAuthUser = {
  id: string
  name: string
  email: string
  role: string
  department: string
  pageAccess: string[]
}

/**
 * The role a user effectively holds on a project.
 *
 * `SuperAdminReadOnly` is the deliberate exception to "non-members cannot view":
 * a Super Admin can open any project for support and debugging, but is never an
 * implicit Owner, cannot mutate anything, cannot comment, and is excluded from
 * notifications. Every other user needs a `project_members` row.
 */
export type EffectiveProjectRole = ProjectRole | "SuperAdminReadOnly"

export function resolveEffectiveRole(
  membership: ProjectRole | null,
  userRole: string
): EffectiveProjectRole | null {
  if (membership) {
    return membership
  }
  if (userRole === "Super Admin") {
    return "SuperAdminReadOnly"
  }
  return null
}

export function canViewProject(role: EffectiveProjectRole | null): boolean {
  return role !== null
}

/** Create / edit / delete phases and activities, and change their status. */
export function canEditProject(role: EffectiveProjectRole | null): boolean {
  return role === "Owner" || role === "Editor"
}

/** Viewers are read-only for content but are explicitly allowed to comment. */
export function canCommentOnProject(role: EffectiveProjectRole | null): boolean {
  return role === "Owner" || role === "Editor" || role === "Viewer"
}

/** Add, remove, and change the role of project members. */
export function canManageMembers(role: EffectiveProjectRole | null): boolean {
  // Editors may manage membership when the Owner delegates day-to-day admin;
  // the Owner row itself is protected separately by the transfer-ownership flow.
  return role === "Owner" || role === "Editor"
}

export function canTransferOwnership(role: EffectiveProjectRole | null): boolean {
  return role === "Owner"
}

export type ProjectRow = RowDataPacket & {
  id: string
  name: string
  description: string | null
  start_date: string
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  created_by_name: string | null
  owner_user_id: string | null
  owner_name: string | null
  member_count: number
}

export const projectSelectSql = `
  SELECT
    projects.id,
    projects.name,
    projects.description,
    projects.start_date,
    projects.created_by_user_id,
    projects.created_at,
    projects.updated_at,
    created_by.name AS created_by_name,
    owner_member.user_id AS owner_user_id,
    owner_user.name AS owner_name,
    (
      SELECT COUNT(*) FROM project_members AS pm WHERE pm.project_id = projects.id
    ) AS member_count
  FROM projects
  LEFT JOIN users AS created_by
    ON created_by.id = projects.created_by_user_id
  LEFT JOIN project_members AS owner_member
    ON owner_member.project_id = projects.id AND owner_member.role = 'Owner'
  LEFT JOIN users AS owner_user
    ON owner_user.id = owner_member.user_id
`

export type MappedProject = {
  id: string
  name: string
  description: string | null
  startDate: string
  createdByUserId: string | null
  createdByName: string | null
  ownerUserId: string | null
  ownerName: string | null
  memberCount: number
  createdAt: string
  updatedAt: string
}

export function mapProject(row: ProjectRow): MappedProject {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    createdByName: row.created_by_name,
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    ownerName: row.owner_name,
    memberCount: Number(row.member_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type ProjectMemberRow = RowDataPacket & {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  created_at: string
  user_name: string | null
  user_email: string | null
  user_department: string | null
}

export const projectMemberSelectSql = `
  SELECT
    project_members.id,
    project_members.project_id,
    project_members.user_id,
    project_members.role,
    project_members.created_at,
    member_user.name AS user_name,
    member_user.email AS user_email,
    member_user.department AS user_department
  FROM project_members
  LEFT JOIN users AS member_user
    ON member_user.id = project_members.user_id
`

export type MappedProjectMember = {
  id: string
  projectId: string
  userId: string
  role: ProjectRole
  userName: string | null
  userEmail: string | null
  userDepartment: string | null
  createdAt: string
}

export function mapProjectMember(row: ProjectMemberRow): MappedProjectMember {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    role: row.role,
    userName: row.user_name,
    userEmail: row.user_email,
    userDepartment: row.user_department,
    createdAt: row.created_at,
  }
}

export type ProjectInput = {
  name: string
  description: string | null
  startDate: string
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validates a create/update project payload. Pure — no DB access — so the rules
 * are unit-testable and identical on create and update.
 */
export function validateProjectInput(
  payload: unknown
): { ok: true; value: ProjectInput } | { ok: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Invalid request body." }
  }
  const body = payload as Record<string, unknown>

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return { ok: false, error: "Project name is required." }
  }
  if (name.length > 160) {
    return { ok: false, error: "Project name must be 160 characters or fewer." }
  }

  const rawDescription =
    typeof body.description === "string" ? body.description.trim() : ""
  const description = rawDescription ? rawDescription : null

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : ""
  if (!ISO_DATE_PATTERN.test(startDate)) {
    return { ok: false, error: "Start date must be a valid YYYY-MM-DD date." }
  }
  if (Number.isNaN(new Date(`${startDate}T00:00:00Z`).getTime())) {
    return { ok: false, error: "Start date must be a valid YYYY-MM-DD date." }
  }

  return { ok: true, value: { name, description, startDate } }
}
