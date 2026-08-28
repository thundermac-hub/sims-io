import { NextRequest, NextResponse } from "next/server"
import { notFound, serverError } from "@/lib/api-errors"

import { resolveApiUser } from "@/lib/api-auth"
import { isOwnObject } from "@/lib/object-access"
import { cleanupPlusUpload } from "@/lib/plus-import"
import { parseJsonBody } from "@/lib/validation"

import { plusUploadKeySchema } from "../schema"

export async function POST(request: NextRequest) {
  const auth = await resolveApiUser(request, { allowedPaths: ["/plus"] })
  if ("response" in auth) {
    return auth.response
  }

  const payload = await parseJsonBody(request, plusUploadKeySchema)
  if (!payload.ok) {
    return payload.response
  }

  try {
    const key = payload.data.key
    if (!key) {
      // Absent key stays a no-op so client cleanup-on-unmount never errors.
      return NextResponse.json({ ok: true })
    }
    // PLUS spreadsheets are never shared: only the uploader may delete.
    if (!isOwnObject(auth.user, key)) {
      return notFound("File not found.")
    }
    await cleanupPlusUpload(key.key)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("plus/cleanup", error, "Unable to clean up PLUS upload.")
  }
}
