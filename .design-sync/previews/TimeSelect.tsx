import * as React from "react"
import { TimeSelect, Label } from "sims"

export const Default = () => {
  const [value, setValue] = React.useState("10:30")
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-2">
      <Label htmlFor="ts-1">Appointment time</Label>
      <TimeSelect id="ts-1" value={value} onChange={setValue} />
    </div>
  )
}

export const BusinessHours = () => {
  const [value, setValue] = React.useState("14:15")
  return (
    <div className="w-full max-w-[220px]">
      <TimeSelect
        value={value}
        onChange={setValue}
        stepMinutes={15}
        startHour={9}
        endHour={18}
      />
    </div>
  )
}

export const Empty = () => {
  const [value, setValue] = React.useState("")
  return (
    <div className="w-full max-w-[220px]">
      <TimeSelect value={value} onChange={setValue} placeholder="Select time" />
    </div>
  )
}

export const Disabled = () => (
  <div className="w-full max-w-[220px]">
    <TimeSelect value="09:00" onChange={() => {}} disabled />
  </div>
)
