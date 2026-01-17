import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const leads = [
  {
    name: "Hana Food Court",
    detail: "Wants onboarding demo",
    time: "4m",
  },
  {
    name: "Brew Bros",
    detail: "Asked for pricing and POS bundle",
    time: "12m",
  },
  {
    name: "Daily Grocer",
    detail: "Needs multi outlet setup",
    time: "22m",
  },
]

export default function SalesWhatsAppInboxPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sales WhatsApp Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Lead conversations from WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Active leads</CardTitle>
          <Input placeholder="Search by lead or outlet" />
        </CardHeader>
        <CardContent className="space-y-3">
          {leads.map((lead, index) => (
            <div key={lead.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{lead.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {lead.detail}
                  </div>
                </div>
                <span className="text-muted-foreground text-xs">
                  {lead.time}
                </span>
              </div>
              {index < leads.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
