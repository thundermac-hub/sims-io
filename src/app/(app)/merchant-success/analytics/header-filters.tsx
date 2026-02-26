"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TimeFilter = "all" | "period"

function getCurrentMonthValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function getMonthLabel(monthValue: string) {
  const [yearText, monthText] = monthValue.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthValue
  }
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function MerchantSuccessAnalyticsHeaderFilters({
  filter,
  monthValue,
  monthOptions,
}: {
  filter: TimeFilter
  monthValue: string | null
  monthOptions: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selectedMonth, setSelectedMonth] = React.useState(
    monthValue ?? getCurrentMonthValue()
  )
  const availableMonths = React.useMemo(() => {
    if (monthOptions.length) {
      return monthOptions
    }
    return [getCurrentMonthValue()]
  }, [monthOptions])

  React.useEffect(() => {
    setSelectedMonth(monthValue ?? getCurrentMonthValue())
  }, [monthValue])

  const updateQuery = React.useCallback(
    (nextFilter: TimeFilter, nextMonth?: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("time", nextFilter)

      if (nextFilter === "period") {
        const month = nextMonth ?? selectedMonth ?? getCurrentMonthValue()
        params.set("month", month)
      } else {
        params.delete("month")
      }

      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams, selectedMonth]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={filter === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => updateQuery("all")}
      >
        All Time
      </Button>
      <Button
        type="button"
        variant={filter === "period" ? "default" : "outline"}
        size="sm"
        onClick={() => updateQuery("period", selectedMonth)}
      >
        Specific Month
      </Button>
      {filter === "period" ? (
        <Select
          value={selectedMonth}
          onValueChange={(nextMonth) => {
            setSelectedMonth(nextMonth)
            updateQuery("period", nextMonth)
          }}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {getMonthLabel(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
