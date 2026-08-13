import { Label, Input, Checkbox } from "sims"

export const Default = () => (
  <div className="flex w-full max-w-[360px] flex-col gap-2">
    <Label htmlFor="lb-1">Outlet name</Label>
    <Input id="lb-1" defaultValue="Jalan Ampang" />
  </div>
)

export const WithCheckbox = () => (
  <div className="flex items-center gap-2">
    <Checkbox id="lb-2" defaultChecked />
    <Label htmlFor="lb-2">Send the merchant a CSAT survey on close</Label>
  </div>
)

export const Disabled = () => (
  <div className="group flex w-full max-w-[360px] flex-col gap-2" data-disabled="true">
    <Label htmlFor="lb-3">Renewal date</Label>
    <Input id="lb-3" defaultValue="2026-09-30" disabled />
  </div>
)
