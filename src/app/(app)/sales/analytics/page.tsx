import type { Metadata } from "next"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Sales Analytics",
}

const metrics = [
  { label: "Lead response", value: "6m", delta: "-8%", trend: "down" },
  { label: "Qualified rate", value: "54%", delta: "+5%", trend: "up" },
  { label: "Won deals", value: "21", delta: "+3", trend: "up" },
]

export default function SalesAnalyticsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Pipeline insights for lead qualification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl font-semibold">{metric.value}</div>
              <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300">
                {metric.trend === "up" ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {metric.delta}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/60 h-56 rounded-xl" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top regions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Kuala Lumpur", value: "42%" },
              { label: "Selangor", value: "28%" },
              { label: "Johor", value: "15%" },
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
