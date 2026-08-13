import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
} from "sims"

export const MerchantSummary = () => (
  <Card className="w-[380px]">
    <CardHeader>
      <CardTitle>Kopitiam Sentral</CardTitle>
      <CardDescription>3 outlets · Renewal in 42 days</CardDescription>
      <CardAction>
        <Button variant="outline" size="sm">
          View
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent className="text-muted-foreground text-sm">
      Last ticket resolved 6 days ago. POS plan is on Slurp! PLUS with 2 seats
      pending activation.
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Open tickets</Button>
      <Button size="sm" variant="ghost">
        Contact owner
      </Button>
    </CardFooter>
  </Card>
)

export const StatTiles = () => (
  <div className="flex flex-wrap gap-4">
    {[
      { label: "Open tickets", value: "24", delta: "+3 today" },
      { label: "Leads this week", value: "112", delta: "+18%" },
      { label: "Renewals due", value: "9", delta: "next 30 days" },
    ].map((s) => (
      <Card key={s.label} className="w-[200px] gap-2 py-4">
        <CardHeader className="px-4">
          <CardDescription>{s.label}</CardDescription>
          <CardTitle className="text-2xl">{s.value}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground px-4 text-xs">
          {s.delta}
        </CardContent>
      </Card>
    ))}
  </div>
)

export const ContentOnly = () => (
  <Card className="w-[380px]">
    <CardContent className="text-sm">
      Appointment confirmed for 14 Aug, 10:30am at Jalan Ampang outlet.
    </CardContent>
  </Card>
)
