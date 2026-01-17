import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const merchants = [
  {
    name: "Bayan Mart",
    fid: "FID-203",
    outlets: 4,
    status: "Active",
  },
  {
    name: "Maju Rasa",
    fid: "FID-119",
    outlets: 2,
    status: "Active",
  },
  {
    name: "Kopi Kuat",
    fid: "FID-088",
    outlets: 1,
    status: "Suspended",
  },
]

export default function MerchantsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Merchants</h1>
        <p className="text-muted-foreground text-sm">
          Franchise and outlet details synced from POS.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Franchise list</CardTitle>
          <Input placeholder="Search by franchise or FID" />
        </CardHeader>
        <CardContent className="space-y-4">
          {merchants.map((merchant, index) => (
            <div key={merchant.fid} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{merchant.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {merchant.fid} - {merchant.outlets} outlets
                  </div>
                </div>
                <span className="text-muted-foreground text-xs">
                  {merchant.status}
                </span>
              </div>
              {index < merchants.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
