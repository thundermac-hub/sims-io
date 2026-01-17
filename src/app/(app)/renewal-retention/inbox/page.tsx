import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const conversations = [
  {
    outlet: "Bayan Mart - KLCC",
    detail: "Asked for payment link",
    time: "3m",
  },
  {
    outlet: "Maju Rasa - PJ",
    detail: "Confirmed renewal for next month",
    time: "12m",
  },
  {
    outlet: "Kopi Kuat - Cheras",
    detail: "Requested invoice copy",
    time: "19m",
  },
]

export default function RenewalRetentionInboxPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Renewal & Retention Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          WhatsApp conversations for renewals.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Active conversations</CardTitle>
          <Input placeholder="Search by outlet" />
        </CardHeader>
        <CardContent className="space-y-3">
          {conversations.map((item, index) => (
            <div key={item.outlet} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{item.outlet}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.detail}
                  </div>
                </div>
                <span className="text-muted-foreground text-xs">
                  {item.time}
                </span>
              </div>
              {index < conversations.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
