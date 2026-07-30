"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, Pencil } from "lucide-react"

import { formatDate } from "@/lib/dates"
import { canEditProject, canManageMembers } from "@/lib/projects"
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ProjectDialog } from "../project-dialog"
import { ProjectRoleBadge } from "../project-role-badge"
import type { ProjectDetail, ProjectListItem, ProjectMember } from "../types"
import { MembersPanel } from "./members-panel"

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null)
  const [members, setMembers] = React.useState<ProjectMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [tab, setTab] = React.useState("overview")

  // Show the project name (not the raw id) in the global breadcrumb.
  useSetBreadcrumbLabel(`/projects/${projectId}`, detail?.project.name ?? null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    setDetail(null)
    try {
      const [projectResponse, membersResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/members`),
      ])
      if (projectResponse.status === 404) {
        throw new Error("Project not found, or you do not have access to it.")
      }
      if (!projectResponse.ok) {
        throw new Error("Unable to load project.")
      }
      const projectData = (await projectResponse.json()) as ProjectDetail
      setDetail(projectData)

      if (membersResponse.ok) {
        const membersData = (await membersResponse.json()) as {
          members: ProjectMember[]
        }
        setMembers(membersData.members ?? [])
      } else {
        setMembers([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load project.")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void load()
  }, [load])

  const role = detail?.role ?? null
  const canEdit = canEditProject(role)
  const canManage = canManageMembers(role)

  const handleProjectSaved = (saved: ProjectListItem) => {
    setDetail((current) =>
      current ? { ...current, project: { ...current.project, ...saved } } : current
    )
  }

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm">Loading project...</div>
    )
  }

  if (error || !detail) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <p className="text-destructive text-sm" role="alert">
            {error ?? "Unable to load project."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">Back to projects</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { project } = detail

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground -ml-2 h-7 px-2"
            >
              <Link href="/projects">
                <ChevronLeft className="size-4" />
                All projects
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{project.name}</CardTitle>
              <ProjectRoleBadge role={role} />
            </div>
            <CardDescription>
              {project.description ?? "No description."}
            </CardDescription>
            <p className="text-muted-foreground text-xs">
              Started {formatDate(project.startDate)} · Owner{" "}
              {project.ownerName ?? "—"} · Created {formatDate(project.createdAt)}
              {project.createdByName ? ` by ${project.createdByName}` : ""}
            </p>
          </div>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit project
            </Button>
          ) : null}
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Phases &amp; activities</CardTitle>
              <CardDescription>
                Break this project into phases, then add activities under each
                phase.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Phase and activity tracking is coming next.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <MembersPanel
            projectId={projectId}
            members={members}
            canManage={canManage}
            onMembersChange={setMembers}
          />
        </TabsContent>
      </Tabs>

      <ProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSaved={handleProjectSaved}
      />
    </div>
  )
}
