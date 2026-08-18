import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Label,
  Input,
} from "sims"

export const Open = () => (
  <Popover open>
    <PopoverTrigger asChild>
      <Button variant="outline">Set renewal reminder</Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-sm font-medium">Renewal reminder</div>
          <div className="text-muted-foreground text-sm">
            We&apos;ll email the account owner before the renewal date.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pop-days">Days before</Label>
          <Input id="pop-days" type="number" defaultValue={14} />
        </div>
        <Button size="sm">Save reminder</Button>
      </div>
    </PopoverContent>
  </Popover>
)
