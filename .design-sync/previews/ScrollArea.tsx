import { ScrollArea, Separator } from "sims"

const OUTLETS = [
  "Jalan Ampang",
  "Bangsar South",
  "Mid Valley",
  "Sunway Pyramid",
  "Publika",
  "TRX",
  "Gurney Drive",
  "Straits Quay",
  "Johor Premium",
  "Melaka Raya",
]

export const OutletList = () => (
  <ScrollArea className="h-[180px] w-full max-w-[280px] rounded-md border">
    <div className="p-3">
      <div className="mb-2 text-sm font-medium">Outlets</div>
      {OUTLETS.map((o) => (
        <div key={o}>
          <div className="py-2 text-sm">{o}</div>
          <Separator />
        </div>
      ))}
    </div>
  </ScrollArea>
)

export const TextBlock = () => (
  <ScrollArea className="h-[140px] w-full max-w-[360px] rounded-md border p-3">
    <p className="text-sm leading-relaxed">
      The merchant reported that orders placed on terminal 2 were not reaching
      the dashboard. On inspection the terminal had dropped off the outlet
      network. We replaced the network cable, re-paired the terminal with the
      POS, and confirmed with the owner that the queued orders synced through.
      A follow-up is scheduled for next week to confirm stability during peak
      lunch hours.
    </p>
  </ScrollArea>
)
