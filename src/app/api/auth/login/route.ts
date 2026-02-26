import { NextRequest, NextResponse } from "next/server"
import { scryptSync, timingSafeEqual } from "crypto"

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
  password_hash: string
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

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) {
    return false
  }
  const derived = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(hash, "hex")
  if (storedBuffer.length !== derived.length) {
    return false
  }
  return timingSafeEqual(storedBuffer, derived)
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string
    password?: string
    remember?: boolean
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    )
  }

  let rows: UserRow[]
  try {
    ;[rows] = await queryWithReconnect<UserRow[]>(
      `
      SELECT id, name, email, avatar_url, department, role, status, password_hash, page_access
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
      [email]
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
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    )
  }

  const isValid = verifyPassword(password, user.password_hash)
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    )
  }

  const remember = body.remember === true
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7
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

  const response = NextResponse.json({
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
  response.cookies.set("sims-auth", String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  })

  return response
}
