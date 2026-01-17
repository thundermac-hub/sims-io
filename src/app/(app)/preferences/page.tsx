import { Bell, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function PreferencesPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground text-sm">
          Set your workspace and notification preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="text-muted-foreground size-4" />
              Theme
            </div>
            <span className="text-muted-foreground">System</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="text-muted-foreground size-4" />
              Notifications
            </div>
            <span className="text-muted-foreground">Enabled</span>
          </div>
          <Button size="sm">Save preferences</Button>
        </CardContent>
      </Card>
    </div>
  )
}
