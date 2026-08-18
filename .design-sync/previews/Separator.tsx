import { Separator } from "sims"

export const Horizontal = () => (
  <div className="w-full max-w-[360px]">
    <div className="text-sm font-medium">Merchant details</div>
    <div className="text-muted-foreground text-sm">Kopitiam Sentral · 3 outlets</div>
    <Separator className="my-4" />
    <div className="text-muted-foreground text-sm">
      Renewal due 30 Sep 2026
    </div>
  </div>
)

export const Vertical = () => (
  <div className="flex h-5 items-center gap-3 text-sm">
    <span>Tickets</span>
    <Separator orientation="vertical" />
    <span>Merchants</span>
    <Separator orientation="vertical" />
    <span>Leads</span>
  </div>
)
