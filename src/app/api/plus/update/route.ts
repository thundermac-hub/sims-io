import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { runPlusUpdate } from "@/lib/plus-import"

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

  const payload = (await request.json().catch(() => null)) as { key?: string } | null
  const key = payload?.key?.trim()
  if (!key) {
    return NextResponse.json({ error: "Missing upload key." }, { status: 400 })
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
            key,
            emit,
            { requestedBy: user.id }
          )
          emit({ type: "summary", summary })
        } catch (error) {
          console.error(error)
          emit({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to run PLUS update.",
          })
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
