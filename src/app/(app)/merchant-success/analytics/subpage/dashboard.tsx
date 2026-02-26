"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { AnalyticsData } from "../data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function formatMinutes(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "--"
  }
  if (value < 60) {
    return `${Math.round(value)}m`
  }
  const hours = Math.floor(value / 60)
  const minutes = Math.round(value % 60)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

function chartTooltipValue(value: number | string, unit?: string) {
  if (typeof value === "number") {
    return `${value.toLocaleString()}${unit ?? ""}`
  }
  return `${value}${unit ?? ""}`
}

const chartPalette = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function MerchantSuccessAnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const hourlyData = data.hourly
  const topFidData = data.merchants.slice(0, 10).map((row) => ({
    ...row,
    fidLabel: `FID ${row.fid}`,
  }))

  const outletBreakdownData = data.merchantOutlets.slice(0, 12).map((row) => ({
    label: `${row.fid}-${row.oid}`,
    total: row.total,
    outletName: row.outletName,
  }))

  const issueComposedData = data.issues.slice(0, 10).map((row) => ({
    issue: `${row.category}/${row.subcategory1}`,
    total: row.total,
    avgResolveMinutes: row.avgResolveMinutes ?? 0,
  }))

  const msData = data.msBreakdown.map((row) => ({
    name: row.name,
    tickets: row.totalTickets,
    ticketsPerDay: Number(row.ticketsPerDay.toFixed(2)),
    avgResolveMinutes: row.avgResolveMinutes ?? 0,
  }))

  const dailyData = data.daily.slice(-30)
  const categoryPieData = data.categoryBreakdown.map((row) => ({
    name: row.label,
    value: row.total,
  }))

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tickets</CardDescription>
            <CardTitle className="text-3xl">{data.totalTickets.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved Tickets</CardDescription>
            <CardTitle className="text-3xl">{data.resolvedTickets.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets per Day</CardDescription>
            <CardTitle className="text-3xl">{data.ticketsPerDay.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Avg Resolve Time</CardDescription>
            <CardTitle className="text-3xl">{formatMinutes(data.totalAvgResolveMinutes)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Hourly Ticket</CardTitle>
            <CardDescription>Ticket volume by hour (0-23)</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={2} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => chartTooltipValue(value as number)} />
                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Issue</CardTitle>
            <CardDescription>Most frequent issue hierarchy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xl font-semibold">
              {data.topIssue ? `${data.topIssue.category} / ${data.topIssue.subcategory1}` : "--"}
            </div>
            <div className="text-sm text-muted-foreground">
              {data.topIssue ? data.topIssue.subcategory2 : "No issue in selected window"}
            </div>
            <div className="text-sm">
              {data.topIssue
                ? `${data.topIssue.total} tickets • Avg resolve ${formatMinutes(data.topIssue.avgResolveMinutes)}`
                : "--"}
            </div>
            <div className="text-sm text-muted-foreground">
              Peak hour: {data.busiestHour ? `${data.busiestHour.label} (${data.busiestHour.total})` : "--"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Merchant Frequency by FID</CardTitle>
            <CardDescription>How many tickets per franchise</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFidData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="fidLabel" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => chartTooltipValue(value as number)} />
                <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outlet Breakdown (OID)</CardTitle>
            <CardDescription>Ticket breakdown per outlet under franchises</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outletBreakdownData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => chartTooltipValue(value as number)}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { outletName?: string } | undefined
                    return row?.outletName ? `${label} • ${row.outletName}` : String(label)
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--chart-3))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Issue Analytics</CardTitle>
            <CardDescription>
              Tickets per issue and resolve time by issue (Category/Subcategory)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={issueComposedData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="issue" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" unit="m" />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "avgResolveMinutes") {
                      return chartTooltipValue(value as number, "m")
                    }
                    return chartTooltipValue(value as number)
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="total" name="Tickets" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgResolveMinutes"
                  name="Avg Resolve (m)"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Share</CardTitle>
            <CardDescription>Issue category distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(value) => chartTooltipValue(value as number)} />
                <Legend />
                <Pie data={categoryPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {categoryPieData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>MS Analytics</CardTitle>
            <CardDescription>Tickets per MS PIC and average resolve time per MS</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={msData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" unit="m" />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "avgResolveMinutes") {
                      return chartTooltipValue(value as number, "m")
                    }
                    return chartTooltipValue(value as number)
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="tickets" name="Tickets" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avgResolveMinutes" name="Avg Resolve (m)" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket per Day</CardTitle>
            <CardDescription>Daily ticket trend (latest 30 days in range)</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(dailyData.length / 6) - 1)} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => chartTooltipValue(value as number)} />
                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
