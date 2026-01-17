import { Calendar, MessageSquareText, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const timeline = [
  {
    label: "Inbound message",
    detail: "WhatsApp message received from +60 12-442 1188.",
    time: "09:14",
  },
  {
    label: "Assigned to agent",
    detail: "Farah A. claimed the ticket.",
    time: "09:16",
  },
  {
    label: "Renewal risk detected",
    detail: "Outlet expiry in 12 days.",
    time: "09:18",
  },
]

export default function TicketDetailPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ticket TCK-8841
          </h1>
          <p className="text-muted-foreground text-sm">
            Bayan Mart - KLCC - Renewal due in 12 days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            Escalate
          </Button>
          <Button size="sm">Resolve</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/60 max-w-[80%] rounded-2xl px-4 py-3 text-sm">
              Hi team, payment failed again today. Can we retry tomorrow?
            </div>
            <div className="flex justify-end">
              <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl px-4 py-3 text-sm">
                We can retry in the morning and confirm a new payment link.
              </div>
            </div>
            <div className="bg-muted/60 max-w-[80%] rounded-2xl px-4 py-3 text-sm">
              Please do. Also can you update the invoice email?
            </div>
            <Separator />
            <div className="text-muted-foreground text-xs">
              Waiting on merchant response.
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Pending merchant
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300">
                  High
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned to</span>
                <span>Farah A.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SLA</span>
                <span>Paused</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline.map((item) => (
                <div key={item.label} className="flex gap-3 text-sm">
                  <span className="mt-1 size-2 rounded-full bg-primary" />
                  <div className="space-y-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.detail} - {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-4 text-primary" />
                Send payment link and invoice update.
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Schedule D-7 renewal reminder.
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-primary" />
                Confirm outlet ownership details.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
