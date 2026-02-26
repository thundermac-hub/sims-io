"use client"

import { Bar, BarChart, Cell, Pie, PieChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { AnalyticsData } from "./data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartPalette = [
  "#367eeb",
  "#9bc0ee",
  "#367eeb",
  "#9bc0ee",
  "#367eeb",
]

const hourlyConfig = {
  total: {
    label: "Tickets",
    color: "#367eeb",
  },
} satisfies ChartConfig

const categoryConfig = {
  value: {
    label: "Tickets",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

export function MerchantSuccessOverviewPanels({ data }: { data: AnalyticsData }) {
  const hourly = data.hourly
  const categoryShare = data.categoryBreakdown.slice(0, 6).map((row) => ({
    name: row.label,
    value: row.total,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Hourly Ticket</CardTitle>
          <CardDescription>Overall volume by hour</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={hourlyConfig} className="h-[280px] w-full">
            <BarChart data={hourly}>
              <defs>
                <linearGradient id="overviewHourlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" hideLabel />} />
              <Bar dataKey="total" fill="url(#overviewHourlyFill)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issue Category Share</CardTitle>
          <CardDescription>Top issue categories</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={categoryConfig} className="h-[280px] w-full">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Pie data={categoryShare} dataKey="value" nameKey="name" innerRadius={52} outerRadius={92}>
                {categoryShare.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
