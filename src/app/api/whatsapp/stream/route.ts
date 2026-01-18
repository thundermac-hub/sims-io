import { NextRequest, NextResponse } from "next/server"

import getPool from "@/lib/db"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get("conversationId")?.trim()
  const userId = searchParams.get("userId")?.trim()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId." }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const pool = getPool()

  let lastSeen = 0
  let polling = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      send("ready", { conversationId })

      const poll = async () => {
        if (polling) {
          return
        }
        polling = true
        try {
          const [rows] = await pool.query(
            `
            SELECT created_at
            FROM whatsapp_messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT 1
          `,
            [conversationId]
          )
          const latest = (rows as Array<{ created_at: string }>)[0]?.created_at
          if (latest) {
            const timestamp = new Date(latest).getTime()
            if (timestamp > lastSeen) {
              lastSeen = timestamp
              send("message", { conversationId })
            }
          }
        } catch (error) {
          console.error(error)
        } finally {
          polling = false
        }
      }

      const interval = setInterval(poll, 5000)
      void poll()

      const cleanup = () => {
        clearInterval(interval)
        controller.close()
      }

      request.signal.addEventListener("abort", cleanup)
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
