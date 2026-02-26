import { NextResponse } from "next/server"

import getPool from "@/lib/db"

type CategoryRow = {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
}

type CategoryNode = {
  id: string
  name: string
  sortOrder: number
  subcategories: CategoryNode[]
}

function buildTree(rows: CategoryRow[]) {
  const grouped = new Map<string | null, CategoryRow[]>()
  rows.forEach((row) => {
    const key = row.parent_id ?? null
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)?.push(row)
  })

  const buildLevel = (parentId: string | null): CategoryNode[] => {
    const items = grouped.get(parentId) ?? []
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      sortOrder: item.sort_order,
      subcategories: buildLevel(item.id),
    }))
  }

  return buildLevel(null)
}

export async function GET() {
  const pool = getPool()
  const [rows] = await pool.query(
    `
    SELECT id, name, parent_id, sort_order
    FROM ticket_categories
    ORDER BY sort_order ASC, name ASC
  `
  )

  const categories = buildTree(rows as CategoryRow[])

  return NextResponse.json({ categories })
}
