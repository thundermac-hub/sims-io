import { CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const appointments = [
  {
    merchant: "Bayan Mart - KLCC",
    time: "Today 16:00",
    owner: "Merchant Success",
  },
  {
    merchant: "Brew Bros",
    time: "Tomorrow 11:00",
    owner: "Sales",
  },
  {
    merchant: "Daily Grocer",
    time: "Thu 09:30",
    owner: "Merchant Success",
  },
]

export default function OnboardingAppointmentsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Onboarding Appointment
          </h1>
          <p className="text-muted-foreground text-sm">
            Schedule and track onboarding sessions.
          </p>
        </div>
        <Button size="sm">New appointment</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming sessions</CardTitle>
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
                  <CalendarDays className="size-4" />
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
