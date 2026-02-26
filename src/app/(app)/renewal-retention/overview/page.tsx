import type { Metadata } from "next"
import { CalendarClock, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Renewal Retention Overview",
}

const kpis = [
  {
    label: "Due this week",
    value: "21",
    delta: "+4",
    icon: CalendarClock,
  },
  {
    label: "Recovered",
    value: "28",
    delta: "+6",
    icon: RefreshCw,
  },
  {
    label: "At risk",
    value: "12",
    delta: "-2",
    icon: ShieldCheck,
  },
  {
    label: "Winback rate",
    value: "11%",
    delta: "+1%",
    icon: TrendingUp,
  },
]

export default function RenewalRetentionOverviewPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Renewal & Retention Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            Renewal cadence and recovery performance.
          </p>
        </div>
        <Button size="sm">Run recovery batch</Button>
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
            <CardTitle>Renewal cadence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/60 h-56 rounded-xl" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top recovery reasons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Payment retry", value: "42%" },
              { label: "Invoice update", value: "28%" },
              { label: "Bank transfer", value: "17%" },
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
