import { Mail, Paperclip } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const emails = [
  {
    subject: "Invoice update needed",
    outlet: "Bayan Mart - KLCC",
    time: "09:12",
  },
  {
    subject: "POS sync failure",
    outlet: "Maju Rasa - PJ",
    time: "08:44",
  },
  {
    subject: "Change billing contact",
    outlet: "Kopi Kuat - Cheras",
    time: "07:55",
  },
]

export default function MerchantSuccessEmailInboxPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merchant Success Email Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Escalations, billing, and account updates.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Inbox</CardTitle>
            <Input placeholder="Search by outlet or subject" />
          </CardHeader>
          <CardContent className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.subject}
                className="hover:bg-muted/60 rounded-xl border px-4 py-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold">{email.subject}</div>
                    <div className="text-muted-foreground text-xs">
                      {email.outlet}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {email.time}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice update needed</CardTitle>
            <p className="text-muted-foreground text-xs">
              From ops@bayanmart.my - Today 09:12
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              Hi team, please update the invoice email to billing@bayanmart.my.
            </div>
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="size-3" />
              ops@bayanmart.my
              <Paperclip className="ml-2 size-3" />
              2 attachments
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
