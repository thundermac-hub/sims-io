import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"
import { mapProjectMember, projectMemberSelectSql } from "@/lib/projects"
import type { ProjectMemberRow } from "@/lib/projects"
import { sendProjectNotification } from "@/lib/project-notifications"

import {
  buildProjectDeepLink,
  parseUserId,
  requireProjectAccess,
  withProjectLock,
} from "../../helpers"

type RouteContext = { params: Promise<{ projectId: string }> }

type TransferOutcome =
  | {
      ok: true
      previousOwner: { userId: string; name: string | null; email: string | null }
      newOwner: { userId: string; name: string | null; email: string | null }
    }
  | { ok: false; status: number; error: string }

/**
 * Transfers project ownership to an existing Editor.
 *
 * Restricted to the current Owner. The target must already hold Editor access —
 * a Viewer or a non-member is rejected with guidance rather than silently
 * promoted (PRD §4.7, A6). The previous Owner is demoted to Editor so a project
 * always has exactly one Owner.
 *
 * The whole swap runs under the project row lock: without it two simultaneous
 * transfers could leave a project with two Owners or none, which MySQL cannot
 * prevent with a constraint (there is no partial unique index).
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { projectId } = await params
  const access = await requireProjectAccess(request, projectId, "transferOwnership")
  if ("response" in access) {
    return access.response
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const targetUserId = parseUserId((payload as Record<string, unknown>)?.userId)
  if (targetUserId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 })
  }
  if (String(targetUserId) === access.user.id) {
    return NextResponse.json(
      { error: "You already own this project." },
      { status: 400 }
    )
  }

  const outcome = await withProjectLock<TransferOutcome>(
    access.projectId,
    async (connection) => {
      const [rows] = await connection.query<
        Array<
          RowDataPacket & {
            user_id: string
            role: string
            name: string | null
            email: string | null
          }
        >
      >(
        `SELECT pm.user_id, pm.role, u.name, u.email
         FROM project_members AS pm
         LEFT JOIN users AS u ON u.id = pm.user_id
         WHERE pm.project_id = ? AND pm.user_id IN (?, ?)`,
        [access.projectId, access.user.id, targetUserId]
      )

      const currentOwner = rows.find((row) => row.role === "Owner")
      if (!currentOwner || String(currentOwner.user_id) !== access.user.id) {
        // The Owner changed under us between the capability check and the lock.
        return {
          ok: false,
          status: 409,
          error: "You are no longer the Owner of this project.",
        }
      }

      const target = rows.find(
        (row) => String(row.user_id) === String(targetUserId)
      )
      if (!target) {
        return {
          ok: false,
          status: 400,
          error:
            "That user has no role on this project. Grant them Editor access first.",
        }
      }
      if (target.role !== "Editor") {
        return {
          ok: false,
          status: 400,
          error:
            "Ownership can only be transferred to an Editor. Grant this user Editor access first.",
        }
      }

      // Demote first: the (project_id, user_id) unique key allows both rows to
      // hold any role, so ordering only matters for readability, but leaving the
      // project Owner-less mid-transaction is invisible to other sessions anyway
      // because they are blocked on the row lock.
      await connection.query(
        `UPDATE project_members SET role = 'Editor' WHERE project_id = ? AND user_id = ?`,
        [access.projectId, access.user.id]
      )
      await connection.query(
        `UPDATE project_members SET role = 'Owner' WHERE project_id = ? AND user_id = ?`,
        [access.projectId, targetUserId]
      )

      return {
        ok: true,
        previousOwner: {
          userId: String(currentOwner.user_id),
          name: currentOwner.name,
          email: currentOwner.email,
        },
        newOwner: {
          userId: String(target.user_id),
          name: target.name,
          email: target.email,
        },
      }
    }
  )

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  }

  // AC7: both the previous and the new Owner are told. This is the one event that
  // deliberately includes the actor — they are a party to the transfer, not just
  // the person who triggered it — so it bypasses `notifyProject`'s actor
  // suppression and addresses the two of them directly.
  const recipients = [outcome.previousOwner.email, outcome.newOwner.email]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))

  await sendProjectNotification({
    event: {
      type: "ownershipTransferred",
      projectName: access.projectName,
      itemPath: null,
      actorName: access.user.name,
      previousOwnerName: outcome.previousOwner.name,
      newOwnerName: outcome.newOwner.name,
      deepLink: buildProjectDeepLink(access.projectId, request.nextUrl.origin),
    },
    recipients: [...new Set(recipients)],
  })

  const [memberRows] = await queryWithReconnect<ProjectMemberRow[]>(
    `${projectMemberSelectSql}
     WHERE project_members.project_id = ?
     ORDER BY FIELD(project_members.role, 'Owner', 'Editor', 'Viewer'), member_user.name ASC`,
    [access.projectId]
  )

  return NextResponse.json({
    members: memberRows.map(mapProjectMember),
    previousOwnerName: outcome.previousOwner.name,
    newOwnerName: outcome.newOwner.name,
  })
}
