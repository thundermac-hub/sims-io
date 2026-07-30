"use client"

import * as React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { formatDate } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { ProjectDialog } from "./project-dialog"
import { ProjectRoleBadge } from "./project-role-badge"
import type { ProjectListItem } from "./types"

export function ProjectsView() {
  const [projects, setProjects] = React.useState<ProjectListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const loadProjects = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/projects")
      if (!response.ok) {
        throw new Error("Unable to load projects.")
      }
      const data = (await response.json()) as { projects: ProjectListItem[] }
      setProjects(data.projects ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects.")
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  // Duplicate project names are allowed by design, so the list always shows the
  // owner and creation date to tell them apart. Filtering is client-side: a
  // person's project count is small enough that server paging is overkill.
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return projects
    }
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        (project.ownerName ?? "").toLowerCase().includes(term)
    )
  }, [projects, search])

  const handleSaved = (project: ProjectListItem) => {
    setProjects((current) => {
      const index = current.findIndex((item) => item.id === project.id)
      if (index === -1) {
        return [project, ...current]
      }
      const next = [...current]
      next[index] = project
      return next
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Project Tracker</CardTitle>
            <CardDescription>
              Projects you own or have been given access to, broken down into
              phases and activities.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects or owners"
              className="h-9 w-full text-xs sm:w-[220px]"
            />
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading projects...</div>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={() => void loadProjects()}>
                Try again
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
              <p>
                {projects.length === 0
                  ? "No projects yet."
                  : "No projects match that search."}
              </p>
              {projects.length === 0 ? (
                <p className="text-xs">
                  Create a project to start tracking phases and activities, then
                  add Editors and Viewers.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Your access</th>
                    <th className="px-4 py-3">Members</th>
                    <th className="px-4 py-3">Start date</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project, index) => (
                    <tr
                      key={project.id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold hover:underline"
                        >
                          {project.name}
                        </Link>
                        {project.description ? (
                          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                            {project.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {project.ownerName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ProjectRoleBadge role={project.myRole} />
                      </td>
                      <td className="px-4 py-3 text-xs">{project.memberCount}</td>
                      <td className="px-4 py-3 text-xs">
                        {formatDate(project.startDate)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {formatDate(project.createdAt)}
                        {project.createdByName ? (
                          <span className="text-muted-foreground block">
                            by {project.createdByName}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  )
}
