import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "sims"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

// Ported from the app's own sales/overview + merchant-success analytics charts.
const trendConfig = {
  total: { label: "Leads", color: "#2563eb" },
}

const ticketConfig = {
  opened: { label: "Opened", color: "#e23b3b" },
  resolved: { label: "Resolved", color: "#16a34a" },
}

const trendData = [
  { label: "Jul 14", total: 8 },
  { label: "Jul 21", total: 14 },
  { label: "Jul 28", total: 11 },
  { label: "Aug 4", total: 22 },
  { label: "Aug 11", total: 19 },
  { label: "Aug 18", total: 27 },
]

const ticketData = [
  { label: "Mon", opened: 12, resolved: 9 },
  { label: "Tue", opened: 18, resolved: 14 },
  { label: "Wed", opened: 9, resolved: 12 },
  { label: "Thu", opened: 15, resolved: 13 },
  { label: "Fri", opened: 21, resolved: 18 },
]

export const LeadTrend = () => (
  <Card className="w-[520px]">
    <CardHeader>
      <CardTitle>Lead trend</CardTitle>
      <CardDescription>New leads over the last 6 weeks</CardDescription>
    </CardHeader>
    <CardContent>
      <ChartContainer config={trendConfig} className="h-[220px] w-full">
        <AreaChart data={trendData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="total"
            type="monotone"
            fill="var(--color-total)"
            fillOpacity={0.2}
            stroke="var(--color-total)"
          />
        </AreaChart>
      </ChartContainer>
    </CardContent>
  </Card>
)

export const TicketVolume = () => (
  <Card className="w-[520px]">
    <CardHeader>
      <CardTitle>Ticket volume</CardTitle>
      <CardDescription>Opened vs resolved this week</CardDescription>
    </CardHeader>
    <CardContent>
      <ChartContainer config={ticketConfig} className="h-[220px] w-full">
        <BarChart data={ticketData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="opened" fill="var(--color-opened)" radius={4} />
          <Bar dataKey="resolved" fill="var(--color-resolved)" radius={4} />
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
)
