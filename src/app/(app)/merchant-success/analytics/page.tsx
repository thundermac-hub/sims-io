import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const metrics = [
  { label: "Median FRT", value: "3m 10s", delta: "-12%", trend: "down" },
  { label: "Median ART", value: "21m", delta: "-6%", trend: "down" },
  { label: "CSAT score", value: "4.7", delta: "+0.2", trend: "up" },
]

export default function MerchantSuccessAnalyticsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merchant Success Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Support performance across WhatsApp, email, and forms.
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

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ticket volume by channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/60 h-56 rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
              <div>
                <div className="text-foreground text-sm font-semibold">860</div>
                WhatsApp
              </div>
              <div>
                <div className="text-foreground text-sm font-semibold">240</div>
                Email
              </div>
              <div>
                <div className="text-foreground text-sm font-semibold">184</div>
                Form
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {[
              { label: "Payments", value: "26%" },
              { label: "POS sync", value: "18%" },
              { label: "Onboarding", value: "12%" },
              { label: "WhatsApp templates", value: "9%" },
            ].map((row) => (
              <div key={row.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>{row.label}</span>
                  <span className="text-muted-foreground">{row.value}</span>
                </div>
                <div className="bg-muted/70 h-1.5 rounded-full">
                  <div
                    className="bg-primary h-1.5 rounded-full"
                    style={{ width: row.value }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CSAT distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/60 h-48 rounded-xl" />
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span>Promoters</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                <ArrowUpRight className="size-3" />
                71%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Agent leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { name: "Farah A.", score: "4.9", tickets: "148" },
              { name: "Zul K.", score: "4.7", tickets: "122" },
              { name: "Maya R.", score: "4.6", tickets: "109" },
            ].map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {agent.tickets} tickets
                  </div>
                </div>
                <span className="text-sm font-semibold">{agent.score}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
