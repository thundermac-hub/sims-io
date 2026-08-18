import { Textarea, Label } from "sims"

export const Default = () => (
  <div className="flex w-full max-w-[420px] flex-col gap-2">
    <Label htmlFor="ta-1">Resolution notes</Label>
    <Textarea
      id="ta-1"
      rows={4}
      defaultValue="Replaced the terminal's network cable and re-paired it with the POS. Confirmed orders are syncing again with the merchant on site."
    />
  </div>
)

export const Placeholder = () => (
  <div className="w-full max-w-[420px]">
    <Textarea rows={3} placeholder="Describe the issue in as much detail as you can…" />
  </div>
)

export const Disabled = () => (
  <div className="w-full max-w-[420px]">
    <Textarea rows={3} disabled defaultValue="Closed tickets can't be edited." />
  </div>
)
