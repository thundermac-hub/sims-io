import { FileText } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const forms = [
  {
    title: "POS menu update request",
    outlet: "OneStop - Bangsar",
    time: "10:02",
  },
  {
    title: "Need staff training",
    outlet: "Kopi Kuat - Cheras",
    time: "09:20",
  },
  {
    title: "WhatsApp onboarding help",
    outlet: "Maju Rasa - PJ",
    time: "08:35",
  },
]

export default function MerchantSuccessFormInboxPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merchant Success Form Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Requests submitted from web forms.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Submissions</CardTitle>
            <Input placeholder="Search by outlet or topic" />
          </CardHeader>
          <CardContent className="space-y-3">
            {forms.map((form) => (
              <div
                key={form.title}
                className="hover:bg-muted/60 rounded-xl border px-4 py-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold">{form.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {form.outlet}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {form.time}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">POS menu update request</CardTitle>
            <p className="text-muted-foreground text-xs">
              Submitted by OneStop - Bangsar
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              We need help updating our menu items in POS before Friday.
            </div>
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="size-3" />
              Form ID: FM-2205
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
