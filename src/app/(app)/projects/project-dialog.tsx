"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { ProjectListItem } from "./types"

type ProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pass a project to edit it; omit to create a new one. */
  project?: Pick<ProjectListItem, "id" | "name" | "description" | "startDate"> | null
  onSaved: (project: ProjectListItem) => void
}

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/** Create/edit dialog for a project's name, description, and start date. */
export function ProjectDialog({
  open,
  onOpenChange,
  project = null,
  onSaved,
}: ProjectDialogProps) {
  const isEdit = Boolean(project)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [startDate, setStartDate] = React.useState(todayIsoDate())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset the form each time the dialog opens so a cancelled edit doesn't leak
  // into the next open.
  React.useEffect(() => {
    if (!open) {
      return
    }
    setName(project?.name ?? "")
    setDescription(project?.description ?? "")
    setStartDate(project?.startDate ?? todayIsoDate())
    setError(null)
  }, [open, project])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(
        isEdit && project ? `/api/projects/${project.id}` : "/api/projects",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description.trim() ? description : null,
            startDate,
          }),
        }
      )
      const data = (await response.json()) as {
        project?: ProjectListItem
        error?: string
      }
      if (!response.ok || !data.project) {
        throw new Error(data.error ?? "Unable to save project.")
      }
      onSaved(data.project)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save project.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the project name, description, or start date."
                : "You become the Project Owner and can add Editors and Viewers next."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                maxLength={160}
                required
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Merchant onboarding revamp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-start-date">Start date</Label>
              <Input
                id="project-start-date"
                type="date"
                value={startDate}
                required
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                rows={4}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this project delivering?"
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
