"use client"

import * as React from "react"
import { Crown, Trash2, UserPlus } from "lucide-react"

import { useToast } from "@/components/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ASSIGNABLE_PROJECT_ROLES } from "@/lib/projects"

import { ProjectRoleBadge } from "../project-role-badge"
import type { DirectoryUser, ProjectMember } from "../types"

type MembersPanelProps = {
  projectId: string
  members: ProjectMember[]
  canManage: boolean
  /** Only the current Owner may transfer ownership. */
  canTransfer: boolean
  onMembersChange: (members: ProjectMember[]) => void
}

const NO_SELECTION = "__none__"

export function MembersPanel({
  projectId,
  members,
  canManage,
  canTransfer,
  onMembersChange,
}: MembersPanelProps) {
  const { showToast } = useToast()
  const [directory, setDirectory] = React.useState<DirectoryUser[]>([])
  const [selectedUserId, setSelectedUserId] = React.useState(NO_SELECTION)
  const [selectedRole, setSelectedRole] = React.useState<string>("Editor")
  const [busy, setBusy] = React.useState(false)
  const [removing, setRemoving] = React.useState<ProjectMember | null>(null)
  const [transferTargetId, setTransferTargetId] = React.useState(NO_SELECTION)
  const [confirmTransfer, setConfirmTransfer] = React.useState(false)

  // Ownership can only move to an existing Editor (PRD §4.7 / A6), so a Viewer
  // has to be promoted first. Surfacing that as a disabled control with an
  // explanation beats an empty dropdown.
  const editors = React.useMemo(
    () => members.filter((member) => member.role === "Editor"),
    [members]
  )
  const transferTarget =
    transferTargetId === NO_SELECTION
      ? null
      : editors.find((member) => member.userId === transferTargetId) ?? null

  React.useEffect(() => {
    if (!canManage) {
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch("/api/projects/directory")
        if (!response.ok) {
          return
        }
        const data = (await response.json()) as { users: DirectoryUser[] }
        if (!cancelled) {
          setDirectory(data.users ?? [])
        }
      } catch {
        // Non-fatal: the picker simply stays empty and the panel still lists
        // existing members.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canManage])

  const memberIds = React.useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members]
  )
  const addableUsers = React.useMemo(
    () => directory.filter((user) => !memberIds.has(user.id)),
    [directory, memberIds]
  )

  const applyResponse = async (response: Response, successMessage: string) => {
    const data = (await response.json()) as {
      members?: ProjectMember[]
      error?: string
    }
    if (!response.ok || !data.members) {
      throw new Error(data.error ?? "Unable to update project members.")
    }
    onMembersChange(data.members)
    showToast(successMessage, "success")
  }

  const handleAdd = async () => {
    if (selectedUserId === NO_SELECTION) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      })
      await applyResponse(response, "Member added.")
      setSelectedUserId(NO_SELECTION)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to add member.",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRoleChange = async (member: ProjectMember, role: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role }),
      })
      await applyResponse(response, `${member.userName ?? "Member"} is now ${role}.`)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to change role.",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!removing) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/members?userId=${encodeURIComponent(removing.userId)}`,
        { method: "DELETE" }
      )
      await applyResponse(response, "Access revoked.")
      setRemoving(null)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to revoke access.",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  const handleTransfer = async () => {
    if (!transferTarget) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/transfer-ownership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: transferTarget.userId }),
        }
      )
      const data = (await response.json()) as {
        members?: ProjectMember[]
        newOwnerName?: string | null
        error?: string
      }
      if (!response.ok || !data.members) {
        throw new Error(data.error ?? "Unable to transfer ownership.")
      }
      onMembersChange(data.members)
      setConfirmTransfer(false)
      setTransferTargetId(NO_SELECTION)
      showToast(
        `${data.newOwnerName ?? "The new Owner"} now owns this project. You are now an Editor.`,
        "success"
      )
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to transfer ownership.",
        "error"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project access</CardTitle>
        <CardDescription>
          Owners and Editors can change project content. Viewers are read-only but
          can still comment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[240px]">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {addableUsers.length === 0 ? (
                  <SelectItem value={NO_SELECTION} disabled>
                    No users left to add
                  </SelectItem>
                ) : (
                  addableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} · {user.department}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_PROJECT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={busy || selectedUserId === NO_SELECTION}
              onClick={() => void handleAdd()}
            >
              <UserPlus className="size-4" />
              Add
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                {canManage ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => (
                <tr
                  key={member.id}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{member.userName ?? "—"}</span>
                    <span className="text-muted-foreground block text-xs">
                      {member.userEmail ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {member.userDepartment ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && member.role !== "Owner" ? (
                      <Select
                        value={member.role}
                        disabled={busy}
                        onValueChange={(role) => void handleRoleChange(member, role)}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_PROJECT_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <ProjectRoleBadge role={member.role} />
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      {member.role === "Owner" ? (
                        <span className="text-muted-foreground text-xs">
                          Transfer ownership to change
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => setRemoving(member)}
                        >
                          <Trash2 className="size-4" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canTransfer ? (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <h3 className="text-sm font-semibold">Transfer ownership</h3>
            <p className="text-muted-foreground text-xs">
              Ownership can only be handed to an Editor. The new Owner gains full
              permission management and you become an Editor. Both of you receive
              an email.
            </p>
            {editors.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No Editors on this project yet — grant someone Editor access above
                before transferring ownership.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={transferTargetId}
                  onValueChange={setTransferTargetId}
                >
                  <SelectTrigger className="h-9 w-full text-xs sm:w-[240px]">
                    <SelectValue placeholder="Select an Editor" />
                  </SelectTrigger>
                  <SelectContent>
                    {editors.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.userName ?? member.userEmail ?? member.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !transferTarget}
                  onClick={() => setConfirmTransfer(true)}
                >
                  <Crown className="size-4" />
                  Transfer
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title="Revoke project access?"
        description={
          <>
            {removing?.userName ?? "This user"} will lose access to this project on
            their next page load, and will stop receiving notifications about it.
          </>
        }
        confirmLabel="Revoke access"
        destructive
        loading={busy}
        onConfirm={() => void handleRemove()}
      />

      <ConfirmDialog
        open={confirmTransfer}
        onOpenChange={setConfirmTransfer}
        title="Transfer project ownership?"
        description={
          <>
            {transferTarget?.userName ?? "This Editor"} will become the Project
            Owner with full permission-management rights, and you will be
            reassigned as an Editor. Both of you will be emailed. This cannot be
            undone by you afterwards — only the new Owner can transfer it back.
          </>
        }
        confirmLabel="Transfer ownership"
        loading={busy}
        onConfirm={() => void handleTransfer()}
      />
    </Card>
  )
}
