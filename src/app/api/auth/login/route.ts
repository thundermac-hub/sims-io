import { NextRequest, NextResponse } from "next/server"
import { scryptSync, timingSafeEqual } from "crypto"

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
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    )
  }

  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT id, name, email, avatar_url, department, role, status, password_hash
    FROM users
    WHERE email = ?
    LIMIT 1
  `,
    [email]
  )

  const user = (rows as UserRow[])[0]
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
