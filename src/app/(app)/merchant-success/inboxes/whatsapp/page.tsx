import { Mail, Phone, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const tickets = [
  {
    id: "MS-1182",
    outlet: "Bayan Mart - KLCC",
    contact: "Aisyah",
    preview: "Payment failed again today.",
    status: "Pending merchant",
    time: "2m",
  },
  {
    id: "MS-1179",
    outlet: "Maju Rasa - PJ",
    contact: "Hafiz",
    preview: "WhatsApp catalog not syncing.",
    status: "Open",
    time: "10m",
  },
  {
    id: "MS-1172",
    outlet: "OneStop - Bangsar",
    contact: "Mei Ling",
    preview: "Need to change outlet phone.",
    status: "New",
    time: "20m",
  },
]

export default function MerchantSuccessWhatsAppInboxPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merchant Success WhatsApp Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Live conversations from WhatsApp support.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Queue</CardTitle>
            <Input placeholder="Search by outlet or ticket" />
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                className="hover:bg-muted/60 flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {ticket.outlet}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {ticket.contact} - {ticket.id}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {ticket.time}
                  </span>
                </div>
                <div className="text-sm">{ticket.preview}</div>
                <div className="text-muted-foreground text-xs">
                  {ticket.status}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Bayan Mart - KLCC</CardTitle>
            <p className="text-muted-foreground text-xs">
              Ticket MS-1182 - Assigned to Farah A.
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="space-y-4">
              <div className="bg-muted/60 max-w-[80%] rounded-2xl px-4 py-3 text-sm">
                Hi team, payment failed again today. Can we retry tomorrow?
              </div>
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl px-4 py-3 text-sm">
                  We can retry in the morning and confirm a new payment link.
                </div>
              </div>
            </div>
            <div className="mt-auto space-y-3">
              <Separator />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="size-3" />
                  +60 12-442 1188
                </div>
                <div className="flex items-center gap-1">
                  <Mail className="size-3" />
                  ops@bayanmart.my
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input placeholder="Reply to merchant" />
                <Button size="icon">
                  <Send />
                </Button>
              </div>
              <div className="text-muted-foreground text-xs">
                SLA clock paused while waiting on merchant response.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
