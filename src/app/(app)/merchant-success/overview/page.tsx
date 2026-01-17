import { AlertTriangle, Clock, MessageCircle, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const kpis = [
  {
    label: "Open tickets",
    value: "132",
    delta: "+8%",
    icon: MessageCircle,
  },
  {
    label: "Median FRT",
    value: "3m 10s",
    delta: "-12%",
    icon: Clock,
  },
  {
    label: "CSAT",
    value: "4.7",
    delta: "+0.2",
    icon: Star,
  },
  {
    label: "SLA breaches",
    value: "6",
    delta: "-2",
    icon: AlertTriangle,
  },
]

export default function MerchantSuccessOverviewPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Merchant Success Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            Live health of support queues and SLA performance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            Export
          </Button>
          <Button size="sm">Assign queue</Button>
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Priority queue</CardTitle>
            <CardDescription>Tickets needing immediate attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {[
              {
                title: "Bayan Mart - KLCC",
                detail: "Pending merchant response",
                time: "4m",
              },
              {
                title: "Maju Rasa - PJ",
                detail: "Payment issue escalated",
                time: "9m",
              },
              {
                title: "Kopi Kuat - Cheras",
                detail: "WhatsApp template failure",
                time: "16m",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.detail}
                  </div>
                </div>
                <div className="text-muted-foreground text-xs">{item.time}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily SLA focus</CardTitle>
            <CardDescription>Breaches and near misses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="bg-muted/60 rounded-lg p-4">
              <div className="text-sm font-semibold">6 tickets breached</div>
              <div className="text-muted-foreground text-xs">
                4 in WhatsApp, 2 in form.
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Average FRT</span>
                <span className="font-semibold">3m 10s</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Backlog aging</span>
                <span className="font-semibold">22m</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              View SLA breaches
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
