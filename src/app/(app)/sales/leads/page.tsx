import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const leads = [
  {
    name: "Hana Food Court",
    stage: "Qualified",
    owner: "Maya R.",
    time: "Today",
  },
  {
    name: "Brew Bros",
    stage: "Contacted",
    owner: "Zul K.",
    time: "Yesterday",
  },
  {
    name: "Daily Grocer",
    stage: "New",
    owner: "Farah A.",
    time: "2d ago",
  },
]

const stageStyles: Record<string, string> = {
  New: "bg-primary/10 text-primary",
  Contacted: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Qualified: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

export default function SalesLeadsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Leads</h1>
          <p className="text-muted-foreground text-sm">
            Qualify inbound leads and schedule follow ups.
          </p>
        </div>
        <Button size="sm">New lead</Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Lead pipeline</CardTitle>
          <Input placeholder="Search by lead or owner" />
        </CardHeader>
        <CardContent className="space-y-4">
          {leads.map((lead, index) => (
            <div key={lead.name} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{lead.name}</div>
                  <div className="text-muted-foreground text-xs">
                    Owner {lead.owner}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${stageStyles[lead.stage]}`}
                  >
                    {lead.stage}
                  </span>
                  <span className="text-muted-foreground">{lead.time}</span>
                </div>
              </div>
              {index < leads.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
