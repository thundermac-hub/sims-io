import { NextRequest, NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"
import {
  mapProjectComment,
  parseMentions,
  projectCommentSelectSql,
  validateCommentInput,
} from "@/lib/project-comments"
import type {
  MappedProjectComment,
  ProjectCommentRow,
} from "@/lib/project-comments"

import {
  buildItemPath,
  buildProjectDeepLink,
  loadProjectItems,
  notifyProject,
  parseProjectId,
  requireProjectAccess,
} from "../../../../helpers"

type RouteContext = {
  params: Promise<{ projectId: string; itemId: string }>
}

async function loadComments(
  projectId: number,
  itemId: number
): Promise<MappedProjectComment[]> {
  const [rows] = await queryWithReconnect<ProjectCommentRow[]>(
    `${projectCommentSelectSql}
     WHERE project_item_comments.project_id = ? AND project_item_comments.item_id = ?
     ORDER BY project_item_comments.created_at ASC`,
    [projectId, itemId]
  )
  return rows.map(mapProjectComment)
}

/**
 * Comments are readable by anyone who can view the project — including on a
 * soft-deleted item, so the audit trail stays reachable.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId, itemId: rawItemId } = await params
  const access = await requireProjectAccess(request, projectId, "view")
  if ("response" in access) {
    return access.response
  }
  const itemId = parseProjectId(rawItemId)
  if (itemId === null) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 })
  }

  return NextResponse.json({
    comments: await loadComments(access.projectId, itemId),
  })
}

/**
 * Posts a comment. Requires the "comment" capability, which Viewers have and a
 * read-only Super Admin does not.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId, itemId: rawItemId } = await params
  const access = await requireProjectAccess(request, projectId, "comment")
  if ("response" in access) {
    return access.response
  }
  const itemId = parseProjectId(rawItemId)
  if (itemId === null) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const validated = validateCommentInput(payload)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const [itemRows] = await queryWithReconnect<
    Array<
      RowDataPacket & {
        id: string
        deleted_at: string | null
        parent_deleted_at: string | null
      }
    >
  >(
    `SELECT child.id, child.deleted_at, parent.deleted_at AS parent_deleted_at
     FROM project_items AS child
     LEFT JOIN project_items AS parent ON parent.id = child.parent_item_id
     WHERE child.id = ? AND child.project_id = ? LIMIT 1`,
    [itemId, access.projectId]
  )
  const item = itemRows[0]
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 })
  }
  if (item.deleted_at !== null || item.parent_deleted_at !== null) {
    return NextResponse.json(
      { error: "Cannot comment on a deleted item." },
      { status: 409 }
    )
  }

  // Only project members are mentionable. Markers naming anyone else are
  // downgraded to plain text so a hand-edited payload cannot notify — and thereby
  // leak project content to — someone without access.
  const [memberRows] = await queryWithReconnect<
    Array<RowDataPacket & { user_id: string }>
  >(`SELECT user_id FROM project_members WHERE project_id = ?`, [
    access.projectId,
  ])
  const parsed = parseMentions(
    validated.value.body,
    memberRows.map((row) => String(row.user_id))
  )

  const [result] = await queryWithReconnect<ResultSetHeader>(
    `INSERT INTO project_item_comments (project_id, item_id, body, created_by_user_id)
     VALUES (?, ?, ?, ?)`,
    [access.projectId, itemId, parsed.body, access.user.id]
  )

  const [rows] = await queryWithReconnect<ProjectCommentRow[]>(
    `${projectCommentSelectSql} WHERE project_item_comments.id = ? LIMIT 1`,
    [result.insertId]
  )
  const row = rows[0]
  if (!row) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 })
  }
  const comment = mapProjectComment(row)

  // PRD §4.5(c) + §4.4: the project is notified, and mentioned users are
  // guaranteed to be included. Only mentions that survived membership validation
  // are passed on, so a dropped marker never triggers mail.
  const allItems = await loadProjectItems(access.projectId)
  const commentedItem = allItems.find((candidate) => candidate.id === comment.itemId)
  await notifyProject(
    access.projectId,
    {
      type: "commentPosted",
      projectName: access.projectName,
      itemPath: commentedItem
        ? buildItemPath(commentedItem, allItems)
        : comment.itemName,
      itemType: commentedItem?.itemType ?? null,
      actorName: access.user.name,
      commentBody: comment.body,
      deepLink: buildProjectDeepLink(access.projectId, request.nextUrl.origin),
    },
    access.user.id,
    {
      assigneeUserId: commentedItem?.assignedUserId ?? null,
      mentionedUserIds: parsed.mentionedUserIds,
    }
  )

  return NextResponse.json(
    {
      comment,
      mentionedUserIds: parsed.mentionedUserIds,
      // Surfaced so the UI can tell the author their mention did not land.
      droppedMentions: parsed.droppedNames,
    },
    { status: 201 }
  )
}
