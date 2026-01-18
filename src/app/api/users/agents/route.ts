import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT id, name, email
    FROM users
    WHERE department = 'Merchant Success'
      AND status = 'active'
    ORDER BY name ASC
  `
  )

  return NextResponse.json({ users: rows })
}
