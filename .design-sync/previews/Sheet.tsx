import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Label,
  Input,
} from "sims"

export const Open = () => (
  <Sheet open>
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>Merchant filters</SheetTitle>
        <SheetDescription>
          Narrow the merchant directory before exporting.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sh-region">Region</Label>
          <Input id="sh-region" defaultValue="Klang Valley" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sh-plan">POS plan</Label>
          <Input id="sh-plan" defaultValue="Slurp! PLUS" />
        </div>
      </div>
      <SheetFooter>
        <Button>Apply filters</Button>
        <Button variant="outline">Reset</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
)
