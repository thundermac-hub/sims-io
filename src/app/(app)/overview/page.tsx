import type { Metadata } from "next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Workspace Overview",
}

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workspace Overview</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Quick access to your assigned tools and recent activity.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Use the sidebar to jump into your workspace. Your access is based on
            the pages assigned to your profile.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Need Support?</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            If you are missing a page, contact your admin to update your page
            access.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
