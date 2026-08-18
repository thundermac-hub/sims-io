import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  Label,
} from "sims"

export const Closed = () => (
  <div className="flex w-full max-w-[280px] flex-col gap-2">
    <Label htmlFor="sel-1">Ticket priority</Label>
    <Select defaultValue="high">
      <SelectTrigger id="sel-1">
        <SelectValue placeholder="Select priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="low">Low</SelectItem>
        <SelectItem value="normal">Normal</SelectItem>
        <SelectItem value="high">High</SelectItem>
        <SelectItem value="urgent">Urgent</SelectItem>
      </SelectContent>
    </Select>
  </div>
)

export const Placeholder = () => (
  <div className="w-full max-w-[280px]">
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Assign to agent…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Nadia</SelectItem>
        <SelectItem value="b">Wei Jie</SelectItem>
      </SelectContent>
    </Select>
  </div>
)

// Grouped options live behind the trigger, so this cell shows the shape the
// grouped Select is actually used in: a filter bar of several triggers.
export const FilterBar = () => (
  <div className="flex w-full max-w-[560px] flex-wrap items-center gap-2">
    <Select defaultValue="kl">
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Central</SelectLabel>
          <SelectItem value="kl">Kuala Lumpur</SelectItem>
          <SelectItem value="sgr">Selangor</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Northern</SelectLabel>
          <SelectItem value="png">Penang</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
    <Select defaultValue="30">
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
    <Select>
      <SelectTrigger className="w-[150px]">
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>
  </div>
)

export const Disabled = () => (
  <div className="w-full max-w-[280px]">
    <Select defaultValue="closed" disabled>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>
  </div>
)
