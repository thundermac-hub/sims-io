"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { AnalyticsData } from "../data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const frequencyConfig = {
  total: {
    label: "Tickets",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

export function MerchantFrequencyCharts({ data }: { data: AnalyticsData }) {
  const fidRows = data.merchants.slice(0, 15).map((row) => ({
    fid: `FID ${row.fid}`,
    total: row.total,
    franchiseName: row.franchiseName,
  }))

  const outletRows = data.merchantOutlets.slice(0, 20).map((row) => ({
    oid: `${row.fid}-${row.oid}`,
    total: row.total,
    outletName: row.outletName,
  }))

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Franchise Ticket Frequency (FID)</CardTitle>
          <CardDescription>Top franchises by ticket volume</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={frequencyConfig} className="h-[420px] w-full">
            <BarChart data={fidRows} layout="vertical" margin={{ left: 10, right: 12 }}>
              <defs>
                <linearGradient id="merchantFidFill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.95} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="fid" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as { franchiseName?: string } | undefined
                      return `${String(label)} • ${row?.franchiseName ?? ""}`
                    }}
                  />
                }
              />
              <Bar dataKey="total" fill="url(#merchantFidFill)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outlet Breakdown (OID)</CardTitle>
          <CardDescription>Outlet-level distribution within FID</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={frequencyConfig} className="h-[480px] w-full">
            <BarChart data={outletRows} layout="vertical" margin={{ left: 10, right: 12 }}>
              <defs>
                <linearGradient id="merchantOutletFill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.95} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="oid" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as { outletName?: string } | undefined
                      return `${String(label)} • ${row?.outletName ?? ""}`
                    }}
                  />
                }
              />
              <Bar dataKey="total" fill="url(#merchantOutletFill)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
