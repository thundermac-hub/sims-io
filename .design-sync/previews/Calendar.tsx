import { Calendar } from "sims"

const AUG = new Date(2026, 7, 14)

export const Single = () => (
  <Calendar
    mode="single"
    defaultMonth={AUG}
    selected={AUG}
    className="rounded-md border"
  />
)

export const Range = () => (
  <Calendar
    mode="range"
    defaultMonth={AUG}
    selected={{ from: new Date(2026, 7, 10), to: new Date(2026, 7, 18) }}
    className="rounded-md border"
  />
)

export const WithDisabledDays = () => (
  <Calendar
    mode="single"
    defaultMonth={AUG}
    selected={AUG}
    disabled={{ dayOfWeek: [0, 6] }}
    className="rounded-md border"
  />
)
