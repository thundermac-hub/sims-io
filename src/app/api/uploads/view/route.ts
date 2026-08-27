import { NextRequest, NextResponse } from "next/server"
import { Readable } from "stream"
import { NoSuchKey } from "@aws-sdk/client-s3"

import { resolveApiUser } from "@/lib/api-auth"
import { canReadObject } from "@/lib/object-access"
import { getObjectStream } from "@/lib/storage"
import { parseObjectKey } from "@/lib/storage-keys"
import { EXTENSION_CONTENT_TYPES, INLINE_EXTENSIONS } from "@/lib/upload-types"

/** RFC 5987 filename encoding for Content-Disposition. */
function contentDisposition(kind: "inline" | "attachment", filename: string) {
  const fallback = filename.replace(/[^\w.-]/g, "_")
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(request: NextRequest) {
  const auth = await resolveApiUser(request, {})
  if ("response" in auth) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const parsed = parseObjectKey(searchParams.get("key"))
  if (!parsed) {
    return NextResponse.json({ error: "Invalid key." }, { status: 400 })
  }

  const bucket = process.env.MINIO_BUCKET
  if (!bucket) {
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 500 }
    )
  }

  // Deny with 404, never 403 — a 403 confirms the object exists.
  const allowed = await canReadObject(auth.user, parsed)
  if (!allowed) {
    return NextResponse.json({ error: "File not found." }, { status: 404 })
  }

  try {
    const result = await getObjectStream(bucket, parsed.key)
    if (!result.Body) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    const stream = result.Body instanceof Readable
      ? (Readable.toWeb(result.Body) as unknown as ReadableStream)
      : (result.Body as unknown as ReadableStream)

    // Content type re-derived from the validated key extension — never
    // echoed from stored object metadata (the stored-XSS vector).
    const contentType =
      (EXTENSION_CONTENT_TYPES as Record<string, string>)[parsed.extension] ??
      "application/octet-stream"
    const inline = INLINE_EXTENSIONS.has(parsed.extension)
    const filename = parsed.extension
      ? `${parsed.stem}.${parsed.extension}`
      : parsed.stem

    const headers = new Headers()
    headers.set("Content-Type", contentType)
    // Attachments are per-user content: never cached. Avatars render on
    // every page for every signed-in user and their keys are immutable
    // (timestamp-random stems, objects never rewritten), so they may cache
    // privately in the browser.
    headers.set(
      "Cache-Control",
      parsed.prefix === "avatars"
        ? "private, max-age=86400, immutable"
        : "private, no-store"
    )
    headers.set(
      "Content-Disposition",
      contentDisposition(inline ? "inline" : "attachment", filename)
    )
    // Hard sandbox on served user content: no scripts, no plugins, no frames.
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox")
    headers.set("X-Content-Type-Options", "nosniff")

    return new NextResponse(stream, { headers })
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }
    console.error("[uploads/view] Storage error:", error)
    return NextResponse.json({ error: "Storage is unavailable." }, { status: 500 })
  }
}
