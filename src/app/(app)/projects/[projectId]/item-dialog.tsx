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
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PROJECT_ITEM_STATUSES } from "@/lib/project-items"
import type { MappedProjectItem, ProjectItemType } from "@/lib/project-items"

import type { ProjectMember } from "../types"

const UNASSIGNED_VALUE = "__unassigned__"

type ItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** The kind of item being created. Ignored when editing. */
  itemType: ProjectItemType
  /** Parent phase id — required when creating an activity. */
  parentItemId: string | null
  parentName?: string | null
  item?: MappedProjectItem | null
  members: ProjectMember[]
  onSaved: () => void
  onNeedsConfirmation: (details: {
    message: string
    names: string[]
    retry: () => Promise<void>
  }) => void
}

export function ItemDialog({
  open,
  onOpenChange,
  projectId,
  itemType,
  parentItemId,
  parentName,
  item = null,
  members,
  onSaved,
  onNeedsConfirmation,
}: ItemDialogProps) {
  const isEdit = Boolean(item)
  const effectiveType = item?.itemType ?? itemType

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState<string>("Not Started")
  const [assignedUserId, setAssignedUserId] = React.useState(UNASSIGNED_VALUE)
  const [startDate, setStartDate] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }
    setName(item?.name ?? "")
    setDescription(item?.description ?? "")
    setStatus(item?.status ?? "Not Started")
    setAssignedUserId(item?.assignedUserId ?? UNASSIGNED_VALUE)
    setStartDate(item?.startDate ?? "")
    setDueDate(item?.dueDate ?? "")
    setError(null)
  }, [open, item])

  const submit = React.useCallback(
    async (confirmIncompleteChildren: boolean) => {
      setSaving(true)
      setError(null)
      try {
        const response = await fetch(
          isEdit && item
            ? `/api/projects/${projectId}/items/${item.id}`
            : `/api/projects/${projectId}/items`,
          {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemType: effectiveType,
              parentItemId: item ? item.parentItemId : parentItemId,
              name,
              description: description.trim() ? description : null,
              status,
              assignedUserId:
                assignedUserId === UNASSIGNED_VALUE ? null : assignedUserId,
              startDate: startDate || null,
              dueDate: dueDate || null,
              ...(confirmIncompleteChildren
                ? { confirmIncompleteChildren: true }
                : {}),
            }),
          }
        )
        const data = (await response.json()) as {
          item?: MappedProjectItem
          requiresConfirmation?: boolean
          incompleteNames?: string[]
          error?: string
        }

        if (response.status === 409 && data.requiresConfirmation) {
          onNeedsConfirmation({
            message: data.error ?? "This change needs confirmation.",
            names: data.incompleteNames ?? [],
            retry: () => submit(true),
          })
          return
        }
        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Unable to save.")
        }
        onSaved()
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save.")
      } finally {
        setSaving(false)
      }
    },
    [
      assignedUserId,
      description,
      dueDate,
      effectiveType,
      isEdit,
      item,
      name,
      onNeedsConfirmation,
      onOpenChange,
      onSaved,
      parentItemId,
      projectId,
      startDate,
      status,
    ]
  )

  const typeLabel = effectiveType === "Phase" ? "phase" : "activity"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`}
            </DialogTitle>
            <DialogDescription>
              {effectiveType === "Activity" && parentName
                ? `Under phase "${parentName}".`
                : "Phases group the activities that deliver them."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={name}
                maxLength={200}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="item-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ITEM_STATUSES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-assignee">Assigned to</Label>
                <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                  <SelectTrigger id="item-assignee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.userName ?? member.userEmail ?? member.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-start">Start date</Label>
                <DateTimePicker
                  id="item-start"
                  mode="date"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-due">Due date</Label>
                <DateTimePicker
                  id="item-due"
                  mode="date"
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="Select due date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                value={description}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
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
              {saving ? "Saving..." : isEdit ? "Save changes" : `Add ${typeLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
