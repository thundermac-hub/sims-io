import type { Metadata } from "next"

import { EventLog } from "./event-log"
import { RespondioSettings } from "./respondio-settings"

export const metadata: Metadata = {
  title: "Integrations",
}

export default function IntegrationsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Respond.io &rarr; SIMS ticket automation via n8n.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RespondioSettings />
        <EventLog />
      </div>
    </div>
  )
}
