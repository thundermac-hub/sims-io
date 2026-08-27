import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { isOwnObject } from "@/lib/object-access"
import { previewPlusTemplate } from "@/lib/plus-import"
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
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview PLUS template.",
      },
      { status: 500 }
    )
  }
}
