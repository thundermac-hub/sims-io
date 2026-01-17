import { NextRequest, NextResponse } from "next/server"
import { randomBytes, scryptSync } from "crypto"

import getPool from "@/lib/db"

const departments = [
  "Merchant Success",
  "Sales & Marketing",
  "Renewal & Retention",
  "Product & Engineering",
  "General Operation",
] as const
const roles = ["Super Admin", "Admin", "User"] as const

type Department = (typeof departments)[number]
type Role = (typeof roles)[number]
type UserStatus = "active" | "inactive"

type AuthContext = {
  userId: string | null
  role: Role
  department: Department
}

const validDepartments = new Set<string>(departments)
const validRoles = new Set<string>(roles)
const validStatuses = new Set<UserStatus>(["active", "inactive"])

function getAuthContext(request: NextRequest): AuthContext | null {
  const userId = request.headers.get("x-user-id")?.trim() ?? null
  const role = request.headers.get("x-user-role")?.trim()
  const department = request.headers.get("x-user-department")?.trim()
  if (!role || !department) {
    return null
  }
  if (!validRoles.has(role) || !validDepartments.has(department)) {
    return null
  }
  return {
    userId,
    role: role as Role,
    department: department as Department,
  }
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function isDepartment(value: string): value is Department {
  return validDepartments.has(value)
}

function isRole(value: string): value is Role {
  return validRoles.has(value)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = getAuthContext(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const pool = getPool()

  if (auth.role === "User") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { userId } = await context.params
  const [rows] = await pool.query(
    `
    SELECT id, department, role
    FROM users
    WHERE id = ?
  `,
    [userId]
  )

  const existing = (rows as Array<{ id: string; department: string; role: string }>)[0]
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  if (auth.role === "Admin") {
    if (existing.department !== auth.department) {
      return NextResponse.json(
        { error: "Admins can only manage their department." },
        { status: 403 }
      )
    }
    if (existing.role === "Super Admin") {
      return NextResponse.json(
        { error: "Admins cannot update Super Admin users." },
        { status: 403 }
      )
    }
  }

  const body = (await request.json()) as {
    name?: string
    email?: string
    department?: string
    role?: string
    password?: string
    status?: UserStatus
  }

  const updates: string[] = []
  const paramsList: Array<string> = []

  if (body.name?.trim()) {
    updates.push("name = ?")
    paramsList.push(body.name.trim())
  }

  if (body.email?.trim()) {
    updates.push("email = ?")
    paramsList.push(body.email.trim().toLowerCase())
  }

  if (body.department?.trim()) {
    if (!isDepartment(body.department)) {
      return NextResponse.json(
        { error: "Invalid department." },
        { status: 400 }
      )
    }
    if (auth.role === "Admin" && body.department !== auth.department) {
      return NextResponse.json(
        { error: "Admins cannot move users across departments." },
        { status: 403 }
      )
    }
    updates.push("department = ?")
    paramsList.push(body.department)
  }

  if (body.role?.trim()) {
    if (!isRole(body.role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 })
    }
    if (auth.role === "Admin" && body.role === "Super Admin") {
      return NextResponse.json(
        { error: "Admins cannot assign Super Admin role." },
        { status: 403 }
      )
    }
    updates.push("role = ?")
    paramsList.push(body.role)
  }

  if (body.status) {
    if (!validStatuses.has(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    }
    if (body.status === "inactive" && auth.userId === userId) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 403 }
      )
    }
    updates.push("status = ?")
    paramsList.push(body.status)
  }

  if (body.password?.trim()) {
    updates.push("password_hash = ?")
    paramsList.push(hashPassword(body.password.trim()))
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 }
    )
  }

  try {
    await pool.query(
      `
      UPDATE users
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [...paramsList, userId]
    )
  } catch (error) {
    const dbError = error as { code?: string }
    if (dbError.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: "Unable to update user." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
