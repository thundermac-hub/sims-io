import type {
  EffectiveProjectRole,
  MappedProject,
  MappedProjectMember,
} from "@/lib/projects"

/** A project row as returned by `GET /api/projects`. */
export type ProjectListItem = MappedProject & {
  /** The caller's own role, or null for a Super Admin who is not a member. */
  myRole: string | null
}

export type ProjectDetail = {
  project: MappedProject
  role: EffectiveProjectRole
}

export type ProjectMember = MappedProjectMember

/** A user as returned by `GET /api/projects/directory`. */
export type DirectoryUser = {
  id: string
  name: string
  email: string
  department: string
}
