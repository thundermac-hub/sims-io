"use client"

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import type { AnalyticsData } from "../data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const volumeConfig = {
  tickets: {
    label: "Total",
    color: "#367eeb",
  },
  resolved: {
    label: "Resolved",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

const productivityConfig = {
  ticketsPerDay: {
    label: "Tickets/Day",
    color: "#367eeb",
  },
  avgResolveMinutes: {
    label: "Avg Resolve (m)",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

export function MsAnalyticsCharts({ data }: { data: AnalyticsData }) {
  const msRows = data.msBreakdown.map((row) => ({
    name: row.name,
    tickets: row.totalTickets,
    resolved: row.resolvedTickets,
    ticketsPerDay: Number(row.ticketsPerDay.toFixed(2)),
    avgResolveMinutes: row.avgResolveMinutes ?? 0,
  }))

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Tickets per MS PIC</CardTitle>
          <CardDescription>Total and resolved ticket volume by MS</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={volumeConfig} className="h-[380px] w-full">
            <BarChart data={msRows}>
              <defs>
                <linearGradient id="msTotalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-tickets)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-tickets)" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="msResolvedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-resolved)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-resolved)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={58} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Bar dataKey="tickets" fill="url(#msTotalFill)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="resolved" fill="url(#msResolvedFill)" radius={[6, 6, 0, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MS Productivity and Resolve Time</CardTitle>
          <CardDescription>Tickets/day and average resolve time per MS</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={productivityConfig} className="h-[380px] w-full">
            <ComposedChart data={msRows}>
              <defs>
                <linearGradient id="msTicketsPerDayFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ticketsPerDay)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-ticketsPerDay)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={58} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <YAxis yAxisId="right" orientation="right" unit="m" tickLine={false} axisLine={false} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Bar yAxisId="left" dataKey="ticketsPerDay" fill="url(#msTicketsPerDayFill)" radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="avgResolveMinutes" stroke="var(--color-avgResolveMinutes)" strokeWidth={2} dot={false} />
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
