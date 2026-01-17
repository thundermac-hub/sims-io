import { ShieldCheck, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const users = [
  {
    name: "Farah A.",
    email: "farah@engage.local",
    role: "Merchant Success",
    scope: "All outlets",
  },
  {
    name: "Zul K.",
    email: "zul@engage.local",
    role: "Renewal Lead",
    scope: "FID 203",
  },
  {
    name: "Maya R.",
    email: "maya@engage.local",
    role: "Sales",
    scope: "FID 119",
  },
]

export default function UserManagementPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            User Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Control access by role and outlet scope.
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <UserPlus className="size-4" />
          Invite user
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active users</CardTitle>
          <span className="text-muted-foreground text-xs">14 total</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.map((user, index) => (
            <div key={user.email} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {user.email}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {user.role}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    {user.scope}
                  </span>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>
              </div>
              {index < users.length - 1 ? <Separator /> : null}
            </div>
          ))}
          <div className="rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-4" />
              Role scopes are enforced per franchise and outlet.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
