import { NextRequest, NextResponse } from "next/server"
import { serverError } from "@/lib/api-errors"

import { resolveApiUser } from "@/lib/api-auth"
import { isOwnObject } from "@/lib/object-access"
import { previewPlusTemplate } from "@/lib/plus-import"
import { parseObjectKey } from "@/lib/storage-keys"
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
    const key = payload.data.key?.trim()
    if (!key) {
      return NextResponse.json({ error: "Missing upload key." }, { status: 400 })
    }
    const parsed = parseObjectKey(key)
    if (!parsed) {
      return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
    }
    if (!isOwnObject(auth.user, parsed)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    const preview = await previewPlusTemplate(parsed.key)
    return NextResponse.json(preview)
  } catch (error) {
    return serverError("plus/preview", error, "Unable to preview PLUS template.")
  }
}
