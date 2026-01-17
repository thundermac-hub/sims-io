import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const breaches = [
  {
    ticket: "MS-1182",
    outlet: "Bayan Mart - KLCC",
    channel: "WhatsApp",
    breach: "12m",
  },
  {
    ticket: "MS-1171",
    outlet: "Maju Rasa - PJ",
    channel: "Email",
    breach: "18m",
  },
  {
    ticket: "MS-1168",
    outlet: "OneStop - Bangsar",
    channel: "Form",
    breach: "22m",
  },
]

export default function MerchantSuccessSlaBreachesPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Merchant Success SLA Breaches
          </h1>
          <p className="text-muted-foreground text-sm">
            Tickets that exceeded response targets.
          </p>
        </div>
        <Button variant="outline" size="sm">
          Export list
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Breached tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {breaches.map((item, index) => (
            <div key={item.ticket} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {item.outlet} ({item.ticket})
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {item.channel} - Breach {item.breach}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="size-4" />
                  Action required
                </div>
              </div>
              {index < breaches.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
