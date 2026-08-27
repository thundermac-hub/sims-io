import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { isOwnObject } from "@/lib/object-access"
import { notFound } from "@/lib/api-errors"
import { runPlusUpdate } from "@/lib/plus-import"
import { parseJsonBody } from "@/lib/validation"

import { plusUploadKeySchema } from "../schema"

const encoder = new TextEncoder()

function encodeEvent(payload: Record<string, unknown>) {
  return encoder.encode(`${JSON.stringify(payload)}\n`)
}

export async function POST(request: NextRequest) {
  const auth = await resolveApiUser(request, { allowedPaths: ["/plus"] })
  if ("response" in auth) {
    return auth.response
  }
  const user = auth.user

  const payload = await parseJsonBody(request, plusUploadKeySchema)
  if (!payload.ok) {
    return payload.response
  }
  const key = payload.data.key
  if (!key) {
    return NextResponse.json({ error: "Missing upload key." }, { status: 400 })
  }
  if (!isOwnObject(user, key)) {
    return notFound("File not found.")
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        const emit = (event: Record<string, unknown>) => {
          controller.enqueue(encodeEvent(event))
        }

        try {
          emit({ type: "start" })
          const summary = await runPlusUpdate(
            key.key,
            emit,
            { requestedBy: user.id }
          )
          emit({ type: "summary", summary })
        } catch (error) {
          // NDJSON stream, not a response envelope: log the real error and
          // emit a generic message.
          console.error("[plus/update]", error)
          emit({ type: "error", message: "Unable to run PLUS update." })
        } finally {
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
