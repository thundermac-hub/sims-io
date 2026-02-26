import type { Metadata } from "next"

import { MerchantSuccessAnalyticsHeaderFilters } from "../header-filters"
import {
  getAnalyticsAvailableMonths,
  getMerchantSuccessAnalyticsData,
  getMonthDateRange,
  toValidDateInput,
  toValidMonthInput,
  type TimeFilter,
} from "../data"
import { MerchantFrequencyCharts } from "./charts"

export const metadata: Metadata = {
  title: "Merchant Success Analytics - Merchant Frequency",
}

export default async function MerchantSuccessMerchantFrequencyAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ time?: string; month?: string; from?: string; to?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const filter: TimeFilter = params?.time === "period" ? "period" : "all"
  const monthValue =
    toValidMonthInput(params?.month) ??
    (toValidDateInput(params?.from)?.slice(0, 7) ?? null)
  const { fromDate, toDate } = getMonthDateRange(monthValue)

  const [data, monthOptions] = await Promise.all([
    getMerchantSuccessAnalyticsData({ filter, fromDate, toDate }),
    getAnalyticsAvailableMonths(),
  ])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Merchant Frequency Analytics</h1>
          <p className="text-muted-foreground text-sm">Franchise and outlet-level ticket frequency analysis.</p>
        </div>
        <MerchantSuccessAnalyticsHeaderFilters filter={filter} monthValue={monthValue} monthOptions={monthOptions} />
      </div>
      <MerchantFrequencyCharts data={data} />
    </div>
  )
}
