import { ArrowUpRight, CalendarCheck2, Target, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const kpis = [
  {
    label: "New leads",
    value: "78",
    delta: "+14%",
    icon: Target,
  },
  {
    label: "Qualified",
    value: "42",
    delta: "+9%",
    icon: TrendingUp,
  },
  {
    label: "Appointments",
    value: "18",
    delta: "+3",
    icon: CalendarCheck2,
  },
  {
    label: "Win rate",
    value: "21%",
    delta: "+2%",
    icon: ArrowUpRight,
  },
]

export default function SalesOverviewPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Overview</h1>
          <p className="text-muted-foreground text-sm">
            Lead intake and conversion performance.
          </p>
        </div>
        <Button size="sm">Create lead</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{item.label}</CardDescription>
                <div className="text-muted-foreground flex size-8 items-center justify-center rounded-full border">
                  <Icon className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-2xl font-semibold">{item.value}</div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {item.delta}
                </span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead pipeline</CardTitle>
            <CardDescription>Last 30 days movement.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/60 h-56 rounded-xl" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top performing sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "WhatsApp inbound", value: "42%" },
              { label: "Web form", value: "31%" },
              { label: "Referrals", value: "18%" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span>{row.label}</span>
                <span className="text-muted-foreground">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
