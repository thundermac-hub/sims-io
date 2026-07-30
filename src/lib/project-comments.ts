import type { RowDataPacket } from "mysql2/promise"

export const MAX_COMMENT_LENGTH = 4000

/**
 * Canonical inline mention marker: `@[Display Name](userId)`.
 *
 * Mentions are stored in the comment body rather than a join table — see
 * migration 023 for the reasoning. The display name is captured so an old comment
 * still reads correctly if the user is later renamed or deactivated, while the id
 * remains the thing that is resolved and notified.
 */
const MENTION_PATTERN = /@\[([^\]]{1,120})\]\((\d+)\)/g

export type ParsedMention = {
  userId: string
  displayName: string
}

export type ParsedComment = {
  /** Body with markers for non-members rewritten to plain text. */
  body: string
  /** Deduped ids of mentioned users who actually have project access. */
  mentionedUserIds: string[]
  /** Display names of markers that were dropped for lacking access. */
  droppedNames: string[]
}

/**
 * Extracts and validates the mentions in a comment body.
 *
 * A marker only survives if its user id is in `allowedUserIds` — the project's
 * membership. Markers naming anyone else are downgraded to plain text rather than
 * rejecting the whole comment: the picker never offers non-members, so a stray
 * marker means a hand-edited or stale payload, and silently notifying someone
 * without project access would leak project content.
 */
export function parseMentions(
  body: string,
  allowedUserIds: readonly string[]
): ParsedComment {
  const allowed = new Set(allowedUserIds.map(String))
  const mentioned = new Set<string>()
  const droppedNames: string[] = []

  const rewritten = body.replace(
    MENTION_PATTERN,
    (_match, displayName: string, userId: string) => {
      if (allowed.has(userId)) {
        mentioned.add(userId)
        return `@[${displayName}](${userId})`
      }
      droppedNames.push(displayName)
      return `@${displayName}`
    }
  )

  return {
    body: rewritten,
    mentionedUserIds: [...mentioned],
    droppedNames,
  }
}

export type CommentSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; userId: string; displayName: string }

/**
 * Splits a stored body into renderable segments so the UI can highlight mentions
 * without using `dangerouslySetInnerHTML`.
 */
export function splitCommentSegments(body: string): CommentSegment[] {
  const segments: CommentSegment[] = []
  let lastIndex = 0

  // `matchAll` needs its own traversal; MENTION_PATTERN is module-level and
  // global, so never share its lastIndex across calls.
  for (const match of body.matchAll(new RegExp(MENTION_PATTERN))) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ kind: "text", text: body.slice(lastIndex, index) })
    }
    segments.push({
      kind: "mention",
      displayName: match[1],
      userId: match[2],
    })
    lastIndex = index + match[0].length
  }

  if (lastIndex < body.length) {
    segments.push({ kind: "text", text: body.slice(lastIndex) })
  }
  return segments
}

/** Body with mention markers flattened to `@Name`, for emails and previews. */
export function toPlainCommentText(body: string): string {
  return body.replace(new RegExp(MENTION_PATTERN), (_match, displayName) =>
    `@${displayName}`
  )
}

export function validateCommentInput(
  payload: unknown
): { ok: true; value: { body: string } } | { ok: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Invalid request body." }
  }
  const body = (payload as Record<string, unknown>).body
  const text = typeof body === "string" ? body.trim() : ""
  if (!text) {
    return { ok: false, error: "A comment cannot be empty." }
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `A comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
    }
  }
  return { ok: true, value: { body: text } }
}

export type ProjectCommentRow = RowDataPacket & {
  id: string
  project_id: string
  item_id: string
  body: string
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  created_by_name: string | null
  item_name: string | null
}

export const projectCommentSelectSql = `
  SELECT
    project_item_comments.id,
    project_item_comments.project_id,
    project_item_comments.item_id,
    project_item_comments.body,
    project_item_comments.created_by_user_id,
    project_item_comments.created_at,
    project_item_comments.updated_at,
    created_by.name AS created_by_name,
    commented_item.name AS item_name
  FROM project_item_comments
  LEFT JOIN users AS created_by
    ON created_by.id = project_item_comments.created_by_user_id
  LEFT JOIN project_items AS commented_item
    ON commented_item.id = project_item_comments.item_id
`

export type MappedProjectComment = {
  id: string
  projectId: string
  itemId: string
  itemName: string | null
  body: string
  createdByUserId: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export function mapProjectComment(
  row: ProjectCommentRow
): MappedProjectComment {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    itemId: String(row.item_id),
    itemName: row.item_name,
    body: row.body,
    createdByUserId: row.created_by_user_id
      ? String(row.created_by_user_id)
      : null,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
