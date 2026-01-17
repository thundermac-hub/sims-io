import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const leads = [
  {
    name: "Orchid Market",
    detail: "Requested onboarding appointment",
    time: "08:50",
  },
  {
    name: "Sutra Mart",
    detail: "Need quotation for 3 outlets",
    time: "08:10",
  },
  {
    name: "Kedai Runcit Jaya",
    detail: "Interested in WhatsApp integration",
    time: "07:42",
  },
]

export default function SalesFormInboxPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sales Form Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Leads submitted from web forms.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Form leads</CardTitle>
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
