import { Tabs, TabsList, TabsTrigger, TabsContent } from "sims"

export const Default = () => (
  <Tabs defaultValue="open" className="w-full max-w-[460px]">
    <TabsList>
      <TabsTrigger value="open">Open</TabsTrigger>
      <TabsTrigger value="pending">Pending</TabsTrigger>
      <TabsTrigger value="closed">Closed</TabsTrigger>
    </TabsList>
    <TabsContent value="open" className="text-muted-foreground pt-3 text-sm">
      24 open tickets across 11 merchants.
    </TabsContent>
    <TabsContent value="pending" className="text-muted-foreground pt-3 text-sm">
      6 tickets awaiting merchant reply.
    </TabsContent>
    <TabsContent value="closed" className="text-muted-foreground pt-3 text-sm">
      312 tickets closed this month.
    </TabsContent>
  </Tabs>
)

export const TwoTabs = () => (
  <Tabs defaultValue="details" className="w-full max-w-[380px]">
    <TabsList>
      <TabsTrigger value="details">Details</TabsTrigger>
      <TabsTrigger value="activity">Activity</TabsTrigger>
    </TabsList>
    <TabsContent value="details" className="text-muted-foreground pt-3 text-sm">
      Merchant profile, outlets and POS plan.
    </TabsContent>
  </Tabs>
)

export const WithDisabled = () => (
  <Tabs defaultValue="overview" className="w-full max-w-[460px]">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="analytics">Analytics</TabsTrigger>
      <TabsTrigger value="billing" disabled>
        Billing
      </TabsTrigger>
    </TabsList>
    <TabsContent value="overview" className="text-muted-foreground pt-3 text-sm">
      Billing is unavailable for preview accounts.
    </TabsContent>
  </Tabs>
)
