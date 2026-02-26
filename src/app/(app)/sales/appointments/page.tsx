import type { Metadata } from "next"
import { CalendarCheck2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Sales Appointment",
}

const appointments = [
  {
    merchant: "Hana Food Court",
    time: "Today 15:00",
    owner: "Maya R.",
  },
  {
    merchant: "Brew Bros",
    time: "Tomorrow 10:30",
    owner: "Zul K.",
  },
  {
    merchant: "Daily Grocer",
    time: "Thu 11:00",
    owner: "Farah A.",
  },
]

export default function SalesAppointmentsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sales Appointment
          </h1>
          <p className="text-muted-foreground text-sm">
            Upcoming onboarding demos and sales calls.
          </p>
        </div>
        <Button size="sm">Create appointment</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {appointments.map((item, index) => (
            <div key={item.merchant} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{item.merchant}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.time} - Owner {item.owner}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarCheck2 className="size-4" />
                  Confirmed
                </div>
              </div>
              {index < appointments.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
