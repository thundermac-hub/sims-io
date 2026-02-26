"use client"

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from "recharts"

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

const chartPalette = [
  "#367eeb",
  "#9bc0ee",
  "#367eeb",
  "#9bc0ee",
  "#367eeb",
]

const issueConfig = {
  total: {
    label: "Tickets",
    color: "#367eeb",
  },
  avgResolveMinutes: {
    label: "Avg Resolve (m)",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

const subcategoryConfig = {
  total: {
    label: "Tickets",
    color: "#9bc0ee",
  },
} satisfies ChartConfig

export function IssueAnalyticsCharts({ data }: { data: AnalyticsData }) {
  const topIssues = data.issues.slice(0, 12).map((row) => ({
    label: `${row.category}/${row.subcategory1}`,
    total: row.total,
    avgResolveMinutes: row.avgResolveMinutes ?? 0,
  }))

  const categories = data.categoryBreakdown.map((row) => ({ name: row.label, value: row.total }))
  const subcategory1 = data.subcategory1Breakdown.slice(0, 10)
  const subcategory2 = data.subcategory2Breakdown.slice(0, 10)

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Issue Volume vs Resolve Time</CardTitle>
          <CardDescription>Category/Subcategory issue count with avg resolve time overlay</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={issueConfig} className="h-[380px] w-full">
            <ComposedChart data={topIssues}>
              <defs>
                <linearGradient id="issueTicketsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} angle={-14} textAnchor="end" height={58} interval={0} />
              <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <YAxis yAxisId="right" orientation="right" unit="m" tickLine={false} axisLine={false} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Bar yAxisId="left" dataKey="total" fill="url(#issueTicketsFill)" radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="avgResolveMinutes" stroke="var(--color-avgResolveMinutes)" strokeWidth={2} dot={false} />
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Category Share</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ value: { label: "Tickets", color: "#367eeb" } }} className="h-[320px] w-full">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Pie data={categories} dataKey="value" nameKey="name" innerRadius={52} outerRadius={95}>
                  {categories.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subcategory 1 and 2 Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid h-[320px] gap-4 md:grid-cols-2">
            <ChartContainer config={subcategoryConfig} className="h-full w-full">
              <BarChart data={subcategory1} layout="vertical" margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="issueSub1Fill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.95} />
                    <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="total" fill="url(#issueSub1Fill)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
            <ChartContainer config={subcategoryConfig} className="h-full w-full">
              <BarChart data={subcategory2} layout="vertical" margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="issueSub2Fill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.95} />
                    <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="total" fill="url(#issueSub2Fill)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
