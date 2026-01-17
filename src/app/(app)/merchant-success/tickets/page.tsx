import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const tickets = [
  {
    id: "MS-1182",
    outlet: "Bayan Mart - KLCC",
    status: "Pending merchant",
    priority: "High",
    time: "2m",
  },
  {
    id: "MS-1179",
    outlet: "Maju Rasa - PJ",
    status: "Open",
    priority: "Normal",
    time: "12m",
  },
  {
    id: "MS-1171",
    outlet: "OneStop - Bangsar",
    status: "New",
    priority: "Low",
    time: "22m",
  },
]

const statusStyles: Record<string, string> = {
  New: "bg-primary/10 text-primary",
  Open: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Pending merchant": "bg-sky-500/10 text-sky-700 dark:text-sky-300",
}

const priorityStyles: Record<string, string> = {
  Low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Normal: "bg-muted text-muted-foreground",
  High: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
}

export default function MerchantSuccessTicketsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Merchant Success Tickets
          </h1>
          <p className="text-muted-foreground text-sm">
            Track open support tickets across channels.
          </p>
        </div>
        <Button size="sm">Create ticket</Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Active tickets</CardTitle>
          <Input placeholder="Search by outlet, ticket, or status" />
        </CardHeader>
        <CardContent className="space-y-4">
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{ticket.outlet}</div>
                  <div className="text-muted-foreground text-xs">
                    Ticket {ticket.id}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${statusStyles[ticket.status]}`}
                  >
                    {ticket.status}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${priorityStyles[ticket.priority]}`}
                  >
                    {ticket.priority}
                  </span>
                  <span className="text-muted-foreground">{ticket.time}</span>
                </div>
              </div>
              {index < tickets.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
