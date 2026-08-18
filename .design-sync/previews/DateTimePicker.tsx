import * as React from "react"
import { DateTimePicker, Label } from "sims"

export const DateMode = () => {
  const [value, setValue] = React.useState("2026-08-14")
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2">
      <Label htmlFor="dtp-1">Renewal date</Label>
      <DateTimePicker id="dtp-1" value={value} onChange={setValue} />
    </div>
  )
}

export const DateTimeMode = () => {
  const [value, setValue] = React.useState("2026-08-14T10:30")
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2">
      <Label htmlFor="dtp-2">Appointment</Label>
      <DateTimePicker
        id="dtp-2"
        mode="datetime"
        value={value}
        onChange={setValue}
      />
    </div>
  )
}

export const Empty = () => {
  const [value, setValue] = React.useState("")
  return (
    <div className="w-full max-w-[300px]">
      <DateTimePicker
        value={value}
        onChange={setValue}
        placeholder="Pick a date"
      />
    </div>
  )
}

export const Disabled = () => (
  <div className="w-full max-w-[300px]">
    <DateTimePicker value="2026-09-30" onChange={() => {}} disabled />
  </div>
)
