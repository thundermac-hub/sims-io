"use client"

import * as React from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ticketChartConfig = {
  total: {
    label: "Tickets",
    color: "#367eeb",
  },
} satisfies ChartConfig

const dailyChartConfig = {
  total: {
    label: "Daily Tickets",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

export function TicketAnalyticsCharts({ data }: { data: AnalyticsData }) {
  const [timeRange, setTimeRange] = React.useState("45d")
  const hourly = data.hourly

  const daily = React.useMemo(() => {
    if (timeRange === "7d") {
      return data.daily.slice(-7)
    }
    if (timeRange === "30d") {
      return data.daily.slice(-30)
    }
    return data.daily.slice(-45)
  }, [data.daily, timeRange])

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hourly Ticket Distribution</CardTitle>
            <CardDescription>Deep view of ticket volume by each hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ticketChartConfig} className="h-[360px] w-full">
              <BarChart data={hourly}>
                <defs>
                  <linearGradient id="ticketsHourlyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" hideLabel />}
                />
                <Bar dataKey="total" fill="url(#ticketsHourlyFill)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="pt-0">
          <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
            <div className="grid flex-1 gap-1">
              <CardTitle>Daily Ticket Trend</CardTitle>
              <CardDescription>Rolling trend in selected period</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="hidden w-[140px] rounded-lg sm:ml-auto sm:flex" aria-label="Select range">
                <SelectValue placeholder="Last 45 days" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="45d" className="rounded-lg">Last 45 days</SelectItem>
                <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
                <SelectItem value="7d" className="rounded-lg">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={dailyChartConfig} className="h-[300px] w-full">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="ticketsDailyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(`${value}T00:00:00`)
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) => {
                        const date = new Date(`${String(value)}T00:00:00`)
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }}
                    />
                  }
                />
                <Area
                  dataKey="total"
                  type="natural"
                  fill="url(#ticketsDailyFill)"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
