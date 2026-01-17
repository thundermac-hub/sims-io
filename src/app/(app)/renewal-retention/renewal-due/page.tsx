import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const renewals = [
  {
    outlet: "Bayan Mart - KLCC",
    due: "Feb 28",
    amount: "MYR 1,980",
    status: "Due",
  },
  {
    outlet: "Maju Rasa - PJ",
    due: "Mar 02",
    amount: "MYR 1,560",
    status: "Overdue",
  },
  {
    outlet: "Kopi Kuat - Cheras",
    due: "Mar 04",
    amount: "MYR 1,200",
    status: "Due",
  },
]

export default function RenewalDuePage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Renewal Due</h1>
          <p className="text-muted-foreground text-sm">
            Outlets requiring renewal follow ups.
          </p>
        </div>
        <Button size="sm">Send reminders</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Due list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renewals.map((item, index) => (
            <div key={item.outlet} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{item.outlet}</div>
                  <div className="text-muted-foreground text-xs">
                    Due {item.due} - {item.amount}
                  </div>
                </div>
                <span className="text-muted-foreground text-xs">
                  {item.status}
                </span>
              </div>
              {index < renewals.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
