import { NextRequest, NextResponse } from "next/server"

import { runMerchantImport } from "@/lib/merchant-import"

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const result = await runMerchantImport("manual")
    return NextResponse.json({ result })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Import failed. Check server logs." },
      { status: 500 }
    )
  }
}
