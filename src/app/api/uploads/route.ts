import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { tooManyRequests } from "@/lib/api-errors"
import { checkRateLimit, getRateLimitIp } from "@/lib/rate-limit"
import {
  buildObjectKey,
  getProxyObjectUrl,
  getPublicObjectUrl,
  uploadObject,
} from "@/lib/storage"
import { resolveUploadType, type UploadFolder } from "@/lib/upload-types"

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const ALLOWED_FOLDERS = new Set<UploadFolder>(["avatars", "uploads"])

export async function POST(request: NextRequest) {
  const auth = await resolveApiUser(request, {})
  if ("response" in auth) {
    return auth.response
  }
  const user = auth.user

  // Composite key: a stolen session can't exhaust the budget from many IPs,
  // and one office IP can't exhaust it for every user behind it.
  const ip = getRateLimitIp(request)
  const rateLimit = await checkRateLimit(`uploads:post:${ip}:${user.id}`, 30, 60)
  if (!rateLimit.allowed) {
    return tooManyRequests(rateLimit.retryAfterSeconds)
  }

  const bucket = process.env.MINIO_BUCKET
  if (!bucket) {
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 500 }
    )
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const folderValue = formData.get("folder")
  const folder: UploadFolder =
    typeof folderValue === "string" &&
    ALLOWED_FOLDERS.has(folderValue as UploadFolder)
      ? (folderValue as UploadFolder)
      : "uploads"

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "File exceeds the 10MB limit." },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // The sniffed type wins: it decides the stored content type and the key
  // extension, regardless of the claimed filename or MIME type.
  const resolved = resolveUploadType(folder, buffer, file.name || undefined)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const key = buildObjectKey(folder, user.id, resolved.type.extension)

  try {
    await uploadObject({
      bucket,
      key,
      body: buffer,
      contentType: resolved.type.mime,
    })
  } catch (error) {
    console.error("Upload failed:", error)
    return NextResponse.json(
      { error: "Storage is unavailable. Please try again." },
      { status: 503 }
    )
  }

  const url = getProxyObjectUrl(key)
  const publicUrl = getPublicObjectUrl(bucket, key)
  return NextResponse.json({ url, publicUrl, key })
}
