"use client"

import * as React from "react"
import { format } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DateRangePicker, type DateRangeValue } from "@/components/date-range-picker"
import { Button } from "@/components/ui/button"

type TimeFilter = "all" | "period"

function parseDateParam(value: string | null) {
  if (!value) {
    return null
  }
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.valueOf()) ? null : date
}

function toDateParam(value: Date | null) {
  if (!value) {
    return null
  }
  return format(value, "yyyy-MM-dd")
}

export function CsatInsightsHeaderFilters({
  filter,
  fromDate,
  toDateValue,
}: {
  filter: TimeFilter
  fromDate: string | null
  toDateValue: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dateRange, setDateRange] = React.useState<DateRangeValue>({
    start: parseDateParam(fromDate),
    end: parseDateParam(toDateValue),
  })

  React.useEffect(() => {
    setDateRange({
      start: parseDateParam(fromDate),
      end: parseDateParam(toDateValue),
    })
  }, [fromDate, toDateValue])

  const updateQuery = React.useCallback(
    (nextFilter: TimeFilter, nextRange?: DateRangeValue) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("time", nextFilter)

      if (nextFilter === "period") {
        const nextFrom = toDateParam(nextRange?.start ?? dateRange.start)
        const nextTo = toDateParam(nextRange?.end ?? dateRange.end)

        if (nextFrom) {
          params.set("from", nextFrom)
        } else {
          params.delete("from")
        }

        if (nextTo) {
          params.set("to", nextTo)
        } else {
          params.delete("to")
        }
      } else {
        params.delete("from")
        params.delete("to")
      }

      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [dateRange.end, dateRange.start, pathname, router, searchParams]
  )

  const handleDateChange = React.useCallback(
    (nextRange: DateRangeValue) => {
      setDateRange(nextRange)
      updateQuery("period", nextRange)
    },
    [updateQuery]
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
        onClick={() => updateQuery("period")}
      >
        Specific Period
      </Button>
      {filter === "period" ? (
        <DateRangePicker
          value={dateRange}
          onChange={handleDateChange}
          className="w-[240px]"
        />
      ) : null}
    </div>
  )
}
