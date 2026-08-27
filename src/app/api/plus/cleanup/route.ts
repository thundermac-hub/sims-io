import { NextRequest, NextResponse } from "next/server"
import { serverError } from "@/lib/api-errors"

import { resolveApiUser } from "@/lib/api-auth"
import { isOwnObject } from "@/lib/object-access"
import { cleanupPlusUpload } from "@/lib/plus-import"
import { parseObjectKey } from "@/lib/storage-keys"

export async function POST(request: NextRequest) {
  const auth = await resolveApiUser(request, { allowedPaths: ["/plus"] })
  if ("response" in auth) {
    return auth.response
  }

  try {
    const payload = (await request.json()) as { key?: string }
    const key = payload.key?.trim()
    if (!key) {
      return NextResponse.json({ ok: true })
    }
    const parsed = parseObjectKey(key)
    if (!parsed) {
      return NextResponse.json({ error: "Invalid key." }, { status: 400 })
    }
    // PLUS spreadsheets are never shared: only the uploader may delete.
    if (!isOwnObject(auth.user, parsed)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }
    await cleanupPlusUpload(parsed.key)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("plus/cleanup", error, "Unable to clean up PLUS upload.")
  }
}
