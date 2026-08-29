import { NextRequest, NextResponse } from "next/server"

import { isRetryableConnectionError, queryWithReconnect } from "@/lib/db"
import {
  buildSessionUser,
  createSession,
  normalizeEmail,
  setAuthCookie,
  verifyPassword,
  type UserStatus,
} from "@/lib/auth"
import { tooManyRequests } from "@/lib/api-errors"
import { checkRateLimit, getRateLimitIp } from "@/lib/rate-limit"
import { parseJsonBody } from "@/lib/validation"

import { loginSchema } from "../schema"

type UserRow = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  department: string
  role: string
  status: UserStatus
  password_hash: string | null
  page_access: unknown
}

function isDatabaseConnectionError(error: unknown) {
  return isRetryableConnectionError(error)
}

export async function POST(request: NextRequest) {
  // SIMS-04: 10 requests per 15 minutes per IP.
  const ip = getRateLimitIp(request)
  const rateLimitResult = await checkRateLimit(`login:${ip}`, 10, 15 * 60)
  if (!rateLimitResult.allowed) {
    return tooManyRequests(
      rateLimitResult.retryAfterSeconds,
      "Too many login attempts. Please try again later."
    )
  }

  const body = await parseJsonBody(request, loginSchema)
  if (!body.ok) {
    return body.response
  }

  const email = normalizeEmail(body.data.email)
  const password = body.data.password?.trim() ?? ""

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
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    )
  }

  if (user.status === "pending_activation") {
    return NextResponse.json(
      {
        error: "Your account is pending activation. Use the activation email to set your password first.",
        code: "activation_required",
      },
      { status: 403 }
    )
  }

  if (user.status !== "active" || !user.password_hash) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    )
  }

  if (!verifyPassword(password, user.password_hash)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    )
  }

  try {
    await queryWithReconnect(
      `
        UPDATE users
        SET last_login_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `,
      [user.id]
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

  const remember = body.data.remember === true
  const rawToken = await createSession(user.id, remember)

  const response = NextResponse.json({
    user: buildSessionUser(user),
  })
  setAuthCookie(response, rawToken, remember)

  return response
}
