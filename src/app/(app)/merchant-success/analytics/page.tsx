import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MerchantSuccessAnalyticsHeaderFilters } from "./header-filters"
import {
  getAnalyticsAvailableMonths,
  getMonthDateRange,
  getMerchantSuccessAnalyticsData,
  toValidDateInput,
  toValidMonthInput,
  type TimeFilter,
} from "./data"
import { MerchantSuccessOverviewPanels } from "./overview-panels"

export const metadata: Metadata = {
  title: "Merchant Success Analytics",
}

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

export default async function MerchantSuccessAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    time?: string
    month?: string
    from?: string
    to?: string
  }>
}) {
  const params = searchParams ? await searchParams : undefined
  const filter: TimeFilter = params?.time === "period" ? "period" : "all"
  const monthValue =
    toValidMonthInput(params?.month) ??
    (toValidDateInput(params?.from)?.slice(0, 7) ?? null)
  const { fromDate, toDate } = getMonthDateRange(monthValue)

  const [data, monthOptions] = await Promise.all([
    getMerchantSuccessAnalyticsData({
      filter,
      fromDate,
      toDate,
    }),
    getAnalyticsAvailableMonths(),
  ])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Merchant Success Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Overall dashboard with drill-down pages for Tickets, Issue, Merchant, and MS analytics.
          </p>
        </div>
        <MerchantSuccessAnalyticsHeaderFilters
          filter={filter}
          monthValue={monthValue}
          monthOptions={monthOptions}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardDescription>Tickets / Day</CardDescription>
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

      <MerchantSuccessOverviewPanels data={data} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hourly Ticket (Text List)</CardTitle>
            <CardDescription>Top hours by ticket count</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.hourly
              .filter((row) => row.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 8)
              .map((row) => (
                <div key={row.hour} className="flex items-center justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="text-muted-foreground">{row.total}</span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merchant Frequency (Text List)</CardTitle>
            <CardDescription>Top FID by ticket count</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.merchants.slice(0, 8).map((row) => (
              <div key={row.fid} className="flex items-center justify-between text-sm">
                <span>
                  FID {row.fid} · {row.franchiseName}
                </span>
                <span className="text-muted-foreground">{row.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue Analytics (Text List)</CardTitle>
            <CardDescription>Top issue hierarchy and resolve time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.issues.slice(0, 8).map((row, index) => (
              <div key={row.issueLabel} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1">{row.issueLabel}</span>
                  <span className="text-muted-foreground">{row.total}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Avg resolve: {formatMinutes(row.avgResolveMinutes)}
                </p>
                {index < 7 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">MS Analytics (Text List)</CardTitle>
            <CardDescription>Tickets per MS and performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.msBreakdown.slice(0, 8).map((row) => (
              <div key={row.name} className="rounded-lg border p-2 text-sm">
                <div className="font-medium">{row.name}</div>
                <div className="text-muted-foreground text-xs">
                  Tickets: {row.totalTickets} · /day: {row.ticketsPerDay.toFixed(2)} · Avg resolve: {formatMinutes(row.avgResolveMinutes)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
