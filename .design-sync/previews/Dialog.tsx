import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
  Input,
} from "sims"

export const Open = () => (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reassign ticket</DialogTitle>
        <DialogDescription>
          Ticket #4821 — POS terminal not syncing at Kopitiam Sentral.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="dlg-agent">Assign to</Label>
        <Input id="dlg-agent" defaultValue="Wei Jie" />
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Reassign</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
