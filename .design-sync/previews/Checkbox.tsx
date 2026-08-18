import { Checkbox, Label } from "sims"

export const States = () => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <Checkbox id="cb-1" />
      <Label htmlFor="cb-1">Unchecked</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="cb-2" defaultChecked />
      <Label htmlFor="cb-2">Checked</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="cb-3" disabled />
      <Label htmlFor="cb-3">Disabled</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="cb-4" disabled defaultChecked />
      <Label htmlFor="cb-4">Disabled + checked</Label>
    </div>
  </div>
)

export const NotificationList = () => (
  <div className="flex flex-col gap-3">
    {[
      ["Ticket status changes", true],
      ["New comments on my tickets", true],
      ["Weekly renewal digest", false],
    ].map(([label, checked], i) => (
      <div key={i} className="flex items-center gap-2">
        <Checkbox id={`cbn-${i}`} defaultChecked={checked as boolean} />
        <Label htmlFor={`cbn-${i}`}>{label as string}</Label>
      </div>
    ))}
  </div>
)
