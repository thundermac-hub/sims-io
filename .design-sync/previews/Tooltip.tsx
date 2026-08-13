import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  Button,
} from "sims"
import { RefreshCw } from "lucide-react"

export const Open = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Resync">
          <RefreshCw />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        Re-sync this ticket with ClickUp
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
