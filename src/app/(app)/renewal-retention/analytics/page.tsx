import type { Metadata } from "next"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Renewal Retention Analytics",
}

const metrics = [
  { label: "Recovery rate", value: "62%", delta: "+4%", trend: "up" },
  { label: "Overdue rate", value: "9%", delta: "-2%", trend: "down" },
  { label: "Winback", value: "11%", delta: "+1%", trend: "up" },
]

export default function RenewalRetentionAnalyticsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Renewal & Retention Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Renewal outcomes and retention trends.
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
            <CardTitle>Renewal pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/60 h-56 rounded-xl" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top recovery channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Form", value: "58%" },
              { label: "Email", value: "28%" },
              { label: "Phone", value: "14%" },
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
