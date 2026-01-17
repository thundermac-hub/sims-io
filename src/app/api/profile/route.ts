import { NextRequest, NextResponse } from "next/server"
import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

import getPool from "@/lib/db"
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
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
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

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT id, name, email, avatar_url, department, role, status
    FROM users
    WHERE id = ?
    LIMIT 1
  `,
    [userId]
  )

  const user = (rows as UserRow[])[0]
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: resolveStoredObjectUrl(user.avatar_url),
      department: user.department,
      role: user.role,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json()) as {
    name?: string
    currentPassword?: string
    newPassword?: string
    avatarUrl?: string | null
  }

  const updates: string[] = []
  const params: Array<string | null> = []

  if (body.name?.trim()) {
    updates.push("name = ?")
    params.push(body.name.trim())
  }

  if (typeof body.avatarUrl !== "undefined") {
    updates.push("avatar_url = ?")
    params.push(body.avatarUrl?.trim() || null)
  }

  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT password_hash
    FROM users
    WHERE id = ?
    LIMIT 1
  `,
    [userId]
  )

  const user = (rows as UserRow[])[0]
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 }
      )
    }
    const isValid = verifyPassword(body.currentPassword, user.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 403 }
      )
    }
    updates.push("password_hash = ?")
    params.push(hashPassword(body.newPassword))
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 }
    )
  }

  await pool.query(
    `
    UPDATE users
    SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    [...params, userId]
  )

  return NextResponse.json({ ok: true })
}
