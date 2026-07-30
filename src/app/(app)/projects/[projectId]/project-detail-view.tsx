"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, Pencil } from "lucide-react"

import { formatDate } from "@/lib/dates"
import {
  canCommentOnProject,
  canEditProject,
  canManageMembers,
  canTransferOwnership,
} from "@/lib/projects"
import type { MappedProjectItem } from "@/lib/project-items"
import type { MappedDependency } from "@/lib/project-dependencies"
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
import { CommentThread } from "./comment-thread"
import { DependencyGraph } from "./dependency-graph"
import { DependencyPanel } from "./dependency-panel"
import { ItemTree } from "./item-tree"
import { MembersPanel } from "./members-panel"

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null)
  const [members, setMembers] = React.useState<ProjectMember[]>([])
  const [items, setItems] = React.useState<MappedProjectItem[]>([])
  const [dependencies, setDependencies] = React.useState<MappedDependency[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [tab, setTab] = React.useState("overview")
  const [showDeleted, setShowDeleted] = React.useState(false)
  // Set when a diagram node's "Comments" action jumps to the Comments tab.
  const [commentItemId, setCommentItemId] = React.useState<string | null>(null)

  // Show the project name (not the raw id) in the global breadcrumb.
  useSetBreadcrumbLabel(`/projects/${projectId}`, detail?.project.name ?? null)

  const loadItems = React.useCallback(async () => {
    try {
      // Always fetch the deleted items too: the "Show deleted" toggle is a pure
      // client-side filter, so flipping it never needs a round trip.
      const response = await fetch(
        `/api/projects/${projectId}/items?includeDeleted=1`
      )
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as { items: MappedProjectItem[] }
      setItems(data.items ?? [])
    } catch {
      setItems([])
    }
  }, [projectId])

  const loadDependencies = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`)
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as { dependencies: MappedDependency[] }
      setDependencies(data.dependencies ?? [])
    } catch {
      setDependencies([])
    }
  }, [projectId])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    setDetail(null)
    try {
      const [projectResponse, membersResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/members`),
        loadItems(),
        loadDependencies(),
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
  }, [loadDependencies, loadItems, projectId])

  React.useEffect(() => {
    void load()
  }, [load])

  const role = detail?.role ?? null
  const canEdit = canEditProject(role)
  const canManage = canManageMembers(role)
  const canComment = canCommentOnProject(role)
  const canTransfer = canTransferOwnership(role)

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
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ItemTree
            projectId={projectId}
            items={items}
            dependencies={dependencies}
            members={members}
            canEdit={canEdit}
            showDeleted={showDeleted}
            onShowDeletedChange={setShowDeleted}
            onItemsChanged={() => {
              void loadItems()
              // A delete can drop dependency rows via ON DELETE CASCADE, and a
              // status change flips unmet flags, so both sets are refetched.
              void loadDependencies()
            }}
          />
        </TabsContent>

        <TabsContent value="diagram">
          <DependencyGraph
            projectId={projectId}
            items={items}
            dependencies={dependencies}
            members={members}
            canEdit={canEdit}
            showDeleted={showDeleted}
            onChanged={() => {
              void loadItems()
              void loadDependencies()
            }}
            onOpenComments={(itemId) => {
              setCommentItemId(itemId)
              setTab("comments")
            }}
          />
        </TabsContent>

        <TabsContent value="dependencies">
          <DependencyPanel
            projectId={projectId}
            items={items}
            dependencies={dependencies}
            canEdit={canEdit}
            onDependenciesChanged={() => void loadDependencies()}
          />
        </TabsContent>

        <TabsContent value="comments">
          <CommentThread
            projectId={projectId}
            items={items}
            members={members}
            canComment={canComment}
            initialItemId={commentItemId}
          />
        </TabsContent>

        <TabsContent value="access">
          <MembersPanel
            projectId={projectId}
            members={members}
            canManage={canManage}
            canTransfer={canTransfer}
            onMembersChange={(next) => {
              setMembers(next)
              // A transfer changes the caller's own role, so the project header
              // and every affordance need the fresh effective role.
              void load()
            }}
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
