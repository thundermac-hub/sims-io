"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"

type Calendar04Props = React.ComponentProps<typeof Calendar>

export default function Calendar04({ className, ...props }: Calendar04Props) {
  return (
    <Calendar
      className={cn("rounded-lg border shadow-sm", className)}
      {...props}
    />
  )
}
