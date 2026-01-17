import { NextRequest, NextResponse } from "next/server"
import { randomBytes, randomUUID, scryptSync } from "crypto"

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

export async function GET(request: NextRequest) {
  const auth = getAuthContext(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (auth.role === "User") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const pool = getPool()

  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true"

  const conditions: string[] = []
  const params: Array<string> = []

  if (!includeInactive) {
    conditions.push("status = 'active'")
  }

  if (auth.role !== "Super Admin") {
    conditions.push("department = ?")
    params.push(auth.department)
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : ""

  const [rows] = await pool.query(
    `
    SELECT id, name, email, department, role, status, created_at, updated_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
  `,
    params
  )

  return NextResponse.json({ users: rows })
}

export async function POST(request: NextRequest) {
  const auth = getAuthContext(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const pool = getPool()

  if (auth.role === "User") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const body = (await request.json()) as {
    name?: string
    email?: string
    department?: string
    role?: string
    password?: string
  }

  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const department = body.department?.trim()
  const role = body.role?.trim()
  const password = body.password?.trim()

  if (!name || !email || !department || !role || !password) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    )
  }

  if (!isDepartment(department) || !isRole(role)) {
    return NextResponse.json({ error: "Invalid role or department." }, { status: 400 })
  }

  if (auth.role === "Admin" && department !== auth.department) {
    return NextResponse.json(
      { error: "Admins can only create users in their department." },
      { status: 403 }
    )
  }

  if (auth.role === "Admin" && role === "Super Admin") {
    return NextResponse.json(
      { error: "Admins cannot create Super Admin users." },
      { status: 403 }
    )
  }

  const id = randomUUID()
  const passwordHash = hashPassword(password)

  try {
    await pool.query(
      `
      INSERT INTO users (id, name, email, department, role, status, password_hash)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `,
      [id, name, email, department, role, passwordHash]
    )
  } catch (error) {
    const dbError = error as { code?: string }
    if (dbError.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: "Unable to create user." }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id,
      name,
      email,
      department,
      role,
      status: "active" as UserStatus,
    },
  })
}
