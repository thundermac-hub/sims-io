import { NextRequest, NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "@/lib/db"

import { resolveProjectsUser } from "../helpers"

type DirectoryRow = RowDataPacket & {
  id: string
  name: string
  email: string
  department: string
}

/**
 * Narrow user directory for the project member picker and the @mention picker.
 *
 * `GET /api/users` cannot be reused here: it returns 403 for `role === "User"`,
 * yet a plain User who owns a project must still be able to add members. This
 * endpoint is gated on `/projects` access instead and exposes only the fields the
 * pickers render — no roles, page access, or auth metadata.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await resolveProjectsUser(request)
  if ("response" in auth) {
    return auth.response
  }

  const [rows] = await queryWithReconnect<DirectoryRow[]>(
    `SELECT id, name, email, department
     FROM users
     WHERE status = 'active' AND is_active = TRUE
     ORDER BY name ASC`
  )

  return NextResponse.json({
    users: rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      email: row.email,
      department: row.department,
    })),
  })
}
