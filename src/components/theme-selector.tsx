"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Select value={theme ?? "system"} onValueChange={setTheme}>
      <SelectTrigger className="h-9 w-[148px] rounded-full border bg-card/90 text-xs font-semibold shadow-sm">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <span className="inline-flex items-center gap-2">
            <Sun className="size-4" />
            Light
          </span>
        </SelectItem>
        <SelectItem value="dark">
          <span className="inline-flex items-center gap-2">
            <Moon className="size-4" />
            Dark
          </span>
        </SelectItem>
        <SelectItem value="system">
          <span className="inline-flex items-center gap-2">
            <Monitor className="size-4" />
            System
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
