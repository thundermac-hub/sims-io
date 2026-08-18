"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDateTime } from "@/lib/dates"
import { cn } from "@/lib/utils"

const ALL_VALUE = "__all__"
const ROW_GRID = "grid-cols-[1.4fr_1fr_0.8fr_1.8fr]"

type WebhookEvent = {
  id: string
  eventType: string
  respondioContactId: string | null
  secretValid: boolean
  status: string
  result: string | null
  ticketId: string | null
  receivedAt: string
  processedAt: string | null
}

/**
 * Status tones, using the hue utilities so they flip in dark mode. The design mock
 * hard-codes hex values because it is a static preview.
 */
const STATUS_TONES: Record<string, string> = {
  processed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ignored: "bg-muted text-muted-foreground",
  noop: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
  processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

const STATUS_FILTERS = [
  "processed",
  "ignored",
  "noop",
  "rejected",
  "failed",
  "processing",
]

/**
 * Human labels for the internal event types. The endpoint normalizes several n8n field
 * spellings down to these three.
 */
const EVENT_LABELS: Record<string, string> = {
  contact_tag_updated: "Contact Tag Updated",
  contact_assignee_updated: "Contact Assignee Updated",
  conversation_closed: "Conversation Closed",
  unknown: "Unrecognised payload",
}

export function EventLog() {
  const [events, setEvents] = React.useState<WebhookEvent[]>([])
  const [total, setTotal] = React.useState(0)
  const [status, setStatus] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const perPage = 25

  React.useEffect(() => {
    setPage(1)
  }, [status])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("per_page", String(perPage))
      if (status) params.set("status", status)

      const response = await fetch(
        `/api/integrations/respond-io/events?${params.toString()}`
      )
      if (!response.ok) {
        throw new Error("Unable to load the event log.")
      }
      const payload = (await response.json()) as {
        events: WebhookEvent[]
        total: number
      }
      setEvents(payload.events ?? [])
      setTotal(payload.total ?? 0)
    } catch (loadError) {
      console.error(loadError)
      setEvents([])
      setTotal(0)
      setError("Unable to load the event log.")
    } finally {
      setLoading(false)
    }
  }, [page, status])

  React.useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Event log</CardTitle>
            <CardDescription>
              Calls received from n8n, processed or rejected.
            </CardDescription>
          </div>
          <Select
            value={status || ALL_VALUE}
            onValueChange={(value) => setStatus(value === ALL_VALUE ? "" : value)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div
          className={cn(
            "text-muted-foreground grid gap-3 border-b px-2 pb-2.5 text-[11px] tracking-wider uppercase",
            ROW_GRID
          )}
        >
          <span>Event</span>
          <span>Respond.io contact</span>
          <span>Status</span>
          <span>Result</span>
        </div>

        {loading ? (
          <div className="text-muted-foreground py-6 text-sm">Loading events...</div>
        ) : error ? (
          <div className="flex items-center gap-3 py-6 text-sm">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : events.length ? (
          <>
            {events.map((event) => (
              <div
                key={event.id}
                className={cn("grid items-center gap-3 border-b px-2 py-3 text-sm", ROW_GRID)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {EVENT_LABELS[event.eventType] ?? event.eventType}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(event.receivedAt)}
                  </span>
                </span>
                <span className="text-muted-foreground truncate font-mono text-xs">
                  {event.respondioContactId ?? "--"}
                </span>
                <span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_TONES[event.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {event.status}
                  </span>
                </span>
                <span className="text-muted-foreground min-w-0 text-xs">
                  {event.ticketId ? (
                    <Link
                      href={`/tickets/${event.ticketId}`}
                      className="text-foreground mr-1 underline"
                    >
                      #{event.ticketId}
                    </Link>
                  ) : null}
                  {event.result ?? "--"}
                </span>
              </div>
            ))}

            <div className="text-muted-foreground flex items-center justify-between pt-3.5 text-xs">
              <span>
                Page {page} of {totalPages} · {total} event{total === 1 ? "" : "s"}
              </span>
              {totalPages > 1 ? (
                <span className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                  >
                    Next
                  </Button>
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground py-6 text-sm">
            No inbound events recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
