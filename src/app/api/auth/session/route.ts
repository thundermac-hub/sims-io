import { NextRequest, NextResponse } from "next/server"

import { queryWithReconnect } from "@/lib/db"
import { resolveStoredObjectUrl } from "@/lib/storage"

type UserRow = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  department: string
  role: string
  status: "active" | "inactive"
  page_access: unknown
}

function isDatabaseConnectionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error ? error.code : undefined
  return (
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EPIPE"
  )
}

export async function GET(request: NextRequest) {
  const authCookie = request.cookies.get("sims-auth")?.value
  if (!authCookie) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let rows: UserRow[]
  try {
    ;[rows] = await queryWithReconnect<UserRow[]>(
      `
      SELECT id, name, email, avatar_url, department, role, status, page_access
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
      [authCookie]
    )
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again." },
        { status: 503 }
      )
    }
    throw error
  }

  const user = rows[0]
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let pageAccess: string[] = []
  if (Array.isArray(user.page_access)) {
    pageAccess = user.page_access.filter((value) => typeof value === "string")
  } else if (typeof user.page_access === "string") {
    try {
      const parsed = JSON.parse(user.page_access)
      pageAccess = Array.isArray(parsed)
        ? parsed.filter((value) => typeof value === "string")
        : []
    } catch {
      pageAccess = []
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: resolveStoredObjectUrl(user.avatar_url),
      department: user.department,
      role: user.role,
      pageAccess,
    },
  })
}
