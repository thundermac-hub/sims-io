import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Button,
  Separator,
} from "sims"
import { ChevronsUpDown } from "lucide-react"

export const Open = () => (
  <Collapsible defaultOpen className="w-full max-w-[340px]">
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">Ticket history</span>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle">
          <ChevronsUpDown />
        </Button>
      </CollapsibleTrigger>
    </div>
    <Separator className="my-2" />
    <CollapsibleContent className="flex flex-col gap-2 text-sm">
      <div>Opened by Nadia · 6 Aug</div>
      <div>Assigned to Wei Jie · 6 Aug</div>
      <div>Resolved · 7 Aug</div>
    </CollapsibleContent>
  </Collapsible>
)

export const Closed = () => (
  <Collapsible className="w-full max-w-[340px]">
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">Advanced filters</span>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle">
          <ChevronsUpDown />
        </Button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="pt-2 text-sm">
      Hidden until expanded.
    </CollapsibleContent>
  </Collapsible>
)
