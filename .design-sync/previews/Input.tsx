import { Input, Label } from "sims"

export const Default = () => (
  <div className="flex w-full max-w-[360px] flex-col gap-2">
    <Label htmlFor="in-1">Merchant name</Label>
    <Input id="in-1" defaultValue="Kopitiam Sentral" />
  </div>
)

export const Placeholder = () => (
  <div className="w-full max-w-[360px]">
    <Input placeholder="Search merchants, tickets or leads" />
  </div>
)

export const Types = () => (
  <div className="flex w-full max-w-[360px] flex-col gap-3">
    <Input type="email" defaultValue="owner@kopitiamsentral.my" />
    <Input type="tel" defaultValue="+60 12-345 6789" />
    <Input type="number" defaultValue={3} />
  </div>
)

export const States = () => (
  <div className="flex w-full max-w-[360px] flex-col gap-3">
    <Input defaultValue="Read-only value" readOnly />
    <Input defaultValue="Disabled" disabled />
    <Input defaultValue="owner@" aria-invalid />
  </div>
)
