import { Bot, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AiChatbotSettingsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Chatbot Settings
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure assistive responses and handoff rules.
          </p>
        </div>
        <Button size="sm">Save changes</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assist mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary size-4" />
                Suggested replies
              </div>
              <span className="text-muted-foreground">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="text-primary size-4" />
                Auto summarization
              </div>
              <span className="text-muted-foreground">Disabled</span>
            </div>
            <Separator />
            <p className="text-muted-foreground text-xs">
              AI responses are reviewed by agents before sending.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Handoff rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Confidence threshold</span>
              <span className="font-semibold">0.72</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Max auto replies</span>
              <span className="font-semibold">2</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Escalation queue</span>
              <span className="text-muted-foreground">Merchant Success</span>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              Edit rules
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
