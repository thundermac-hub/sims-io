"use client"

import * as React from "react"
import {
  addDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Calendar04 from "@/components/calendar-04"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

export type DateRangeValue = {
  start: Date | null
  end: Date | null
}

type DateRangePickerProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

const weekStartsOn = 1

function formatLabel(value: DateRangeValue, placeholder: string) {
  if (!value.start) {
    return placeholder
  }
  if (!value.end) {
    return format(value.start, "dd MMM yyyy")
  }
  return `${format(value.start, "dd MMM yyyy")} - ${format(
    value.end,
    "dd MMM yyyy"
  )}`
}

function formatSelection(value: DateRangeValue) {
  if (!value.start) {
    return "--"
  }
  if (!value.end) {
    return format(value.start, "dd MMM yyyy")
  }
  return `${format(value.start, "dd MMM yyyy")} - ${format(
    value.end,
    "dd MMM yyyy"
  )}`
}

function normalizeDate(value: Date) {
  return startOfDay(value)
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = "Select date",
  disabled,
}: DateRangePickerProps) {
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const label = React.useMemo(
    () => formatLabel(value, placeholder),
    [value, placeholder]
  )
  const selectionLabel = React.useMemo(
    () => formatSelection(value),
    [value]
  )

  const setRange = React.useCallback(
    (start: Date, end: Date | null) => {
      onChange({
        start,
        end,
      })
    },
    [onChange]
  )

  const handleDayClick = React.useCallback(
    (day?: Date) => {
      if (!day) {
        return
      }
      const selected = normalizeDate(day)
      if (!value.start || (value.start && value.end)) {
        setRange(selected, null)
        return
      }

      const start = normalizeDate(value.start)
      let end = selected

      if (isBefore(end, start)) {
        const temp = start
        end = temp
        setRange(selected, temp)
        return
      }

      setRange(start, end)
    },
    [setRange, value.start, value.end]
  )

  const shiftRange = React.useCallback(
    (direction: "back" | "forward") => {
      if (!value.start) {
        return
      }
      const start = normalizeDate(value.start)
      const end = value.end ? normalizeDate(value.end) : start
      const span = Math.max(
        1,
        Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1
      )
      const delta = direction === "back" ? -span : span
      let nextStart = addDays(start, delta)
      let nextEnd = addDays(end, delta)

      if (isAfter(nextEnd, today)) {
        nextEnd = today
        nextStart = subDays(nextEnd, span - 1)
      }

      setRange(nextStart, nextEnd)
    },
    [setRange, today, value.end, value.start]
  )

  const applyQuickRange = React.useCallback(
    (range: { start: Date; end: Date }) => {
      const start = normalizeDate(range.start)
      let end = normalizeDate(range.end)
      if (isAfter(end, today)) {
        end = today
      }
      if (isBefore(end, start)) {
        setRange(end, start)
        return
      }
      setRange(start, end)
    },
    [setRange, today]
  )

  const quickRanges = React.useMemo(() => {
    const yesterday = subDays(today, 1)
    const thisWeekStart = startOfWeek(today, { weekStartsOn })
    const thisMonthStart = startOfMonth(today)
    const lastWeekStart = subDays(thisWeekStart, 7)
    const lastWeekEnd = subDays(thisWeekStart, 1)
    const lastMonthDate = subMonths(today, 1)
    const lastMonthStart = startOfMonth(lastMonthDate)
    const lastMonthEnd = endOfMonth(lastMonthDate)

    return [
      { label: "Today", range: { start: today, end: today } },
      { label: "Yesterday", range: { start: yesterday, end: yesterday } },
      {
        label: "This week",
        range: { start: thisWeekStart, end: today },
      },
      {
        label: "Last week",
        range: { start: lastWeekStart, end: lastWeekEnd },
      },
      {
        label: "This month",
        range: { start: thisMonthStart, end: today },
      },
      {
        label: "Last month",
        range: { start: lastMonthStart, end: lastMonthEnd },
      },
    ]
  }, [today])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-[260px] justify-between px-3 text-sm font-normal",
            !value.start && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="size-4" />
            {label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[440px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Select dates</div>
            <div className="text-xs text-muted-foreground">
              Selected: {selectionLabel}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ start: null, end: null })}
              disabled={!value.start}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => shiftRange("back")}
              disabled={!value.start}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => shiftRange("forward")}
              disabled={!value.start}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <Separator className="my-3" />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-4">
          <Calendar04
            mode="range"
            selected={
              value.start
                ? { from: value.start, to: value.end ?? value.start }
                : undefined
            }
            onDayClick={handleDayClick}
            disabled={{ after: today }}
            toDate={today}
            weekStartsOn={weekStartsOn}
            numberOfMonths={1}
            defaultMonth={value.start ?? today}
          />
          <div className="grid grid-cols-2 gap-2 md:flex md:w-[120px] md:flex-col">
            {quickRanges.map((item) => (
              <Button
                key={item.label}
                variant="outline"
                size="sm"
                onClick={() => applyQuickRange(item.range)}
                className="h-8 px-3 text-xs"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
