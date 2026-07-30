"use client"

import * as React from "react"
import { MessageSquare } from "lucide-react"

import { formatDateTime } from "@/lib/dates"
import { splitCommentSegments } from "@/lib/project-comments"
import type { MappedProjectComment } from "@/lib/project-comments"
import type { MappedProjectItem } from "@/lib/project-items"
import { buildItemTree } from "@/lib/project-items"
import { useToast } from "@/components/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { ProjectMember } from "../types"
import { MentionInput } from "./mention-input"

const NO_SELECTION = "__none__"

type CommentThreadProps = {
  projectId: string
  items: MappedProjectItem[]
  members: ProjectMember[]
  /** Viewers may comment; a read-only Super Admin may not. */
  canComment: boolean
  /** Preselects an item — set when a diagram node jumps here. */
  initialItemId?: string | null
}

/** Renders a stored body, highlighting mention markers without raw HTML. */
function CommentBody({ body }: { body: string }) {
  const segments = React.useMemo(() => splitCommentSegments(body), [body])
  return (
    <p className="text-sm whitespace-pre-wrap">
      {segments.map((segment, index) =>
        segment.kind === "mention" ? (
          <span
            key={index}
            className="rounded bg-teal-500/10 px-1 font-medium text-teal-700 dark:text-teal-400"
          >
            @{segment.displayName}
          </span>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </p>
  )
}

export function CommentThread({
  projectId,
  items,
  members,
  canComment,
  initialItemId = null,
}: CommentThreadProps) {
  const { showToast } = useToast()
  const [selectedItemId, setSelectedItemId] = React.useState(
    initialItemId ?? NO_SELECTION
  )

  // Follow the diagram's "Comments" action when it targets a different item.
  React.useEffect(() => {
    if (initialItemId) {
      setSelectedItemId(initialItemId)
    }
  }, [initialItemId])
  const [comments, setComments] = React.useState<MappedProjectComment[]>([])
  const [loading, setLoading] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [posting, setPosting] = React.useState(false)

  // Comments can be read on deleted items too — the audit trail must stay
  // reachable — but only live items can be commented on.
  const orderedItems = React.useMemo(() => {
    const flat: MappedProjectItem[] = []
    for (const phase of buildItemTree(items)) {
      const { activities, ...rest } = phase
      flat.push(rest as MappedProjectItem)
      flat.push(...activities)
    }
    return flat
  }, [items])

  const selectedItem =
    selectedItemId === NO_SELECTION
      ? null
      : orderedItems.find((item) => item.id === selectedItemId) ?? null

  const loadComments = React.useCallback(async () => {
    if (selectedItemId === NO_SELECTION) {
      setComments([])
      return
    }
    setLoading(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/items/${selectedItemId}/comments`
      )
      if (!response.ok) {
        throw new Error("Unable to load comments.")
      }
      const data = (await response.json()) as {
        comments: MappedProjectComment[]
      }
      setComments(data.comments ?? [])
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [projectId, selectedItemId])

  React.useEffect(() => {
    void loadComments()
  }, [loadComments])

  const handlePost = async () => {
    if (!selectedItem || !draft.trim()) {
      return
    }
    setPosting(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/items/${selectedItem.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft }),
        }
      )
      const data = (await response.json()) as {
        comment?: MappedProjectComment
        droppedMentions?: string[]
        error?: string
      }
      if (!response.ok || !data.comment) {
        throw new Error(data.error ?? "Unable to post comment.")
      }
      setDraft("")
      if (data.droppedMentions?.length) {
        showToast(
          `Comment posted. ${data.droppedMentions.join(", ")} ${
            data.droppedMentions.length === 1 ? "does" : "do"
          } not have access to this project and was not notified.`,
          "info"
        )
      } else {
        showToast("Comment posted.", "success")
      }
      void loadComments()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to post comment.",
        "error"
      )
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
        <CardDescription>
          Discuss a phase or activity. Type @ to mention someone — only people with
          access to this project can be mentioned.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
          <SelectTrigger className="h-9 w-full text-xs sm:w-[320px]">
            <SelectValue placeholder="Select a phase or activity" />
          </SelectTrigger>
          <SelectContent>
            {orderedItems.length === 0 ? (
              <SelectItem value={NO_SELECTION} disabled>
                No items yet
              </SelectItem>
            ) : (
              orderedItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.itemType === "Activity" ? "— " : ""}
                  {item.name}
                  {item.effectivelyDeleted ? " (deleted)" : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {!selectedItem ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            <MessageSquare className="mx-auto mb-2 size-5" />
            Select a phase or activity to read and add comments.
          </p>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border px-3 py-6 text-center text-sm">
                No comments on “{selectedItem.name}” yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border bg-card p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {comment.createdByName ?? "Unknown user"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <CommentBody body={comment.body} />
                  </li>
                ))}
              </ul>
            )}

            {canComment && !selectedItem.effectivelyDeleted ? (
              <div className="space-y-2">
                <MentionInput
                  value={draft}
                  onChange={setDraft}
                  members={members}
                  disabled={posting}
                  placeholder={`Comment on “${selectedItem.name}”. Type @ to mention a member.`}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={posting || !draft.trim()}
                    onClick={() => void handlePost()}
                  >
                    {posting ? "Posting..." : "Post comment"}
                  </Button>
                </div>
              </div>
            ) : selectedItem.effectivelyDeleted ? (
              <p className="text-muted-foreground text-xs">
                This item is deleted. Its comments are kept for audit but no new
                comments can be added — restore it first.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                You have read-only access to this project.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
