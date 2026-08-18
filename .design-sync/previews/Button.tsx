import { Button } from "sims"
import { Plus, Trash2, Loader2 } from "lucide-react"

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="default">Create ticket</Button>
    <Button variant="secondary">Assign to me</Button>
    <Button variant="outline">Export CSV</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="link">View merchant</Button>
    <Button variant="destructive">Delete lead</Button>
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add">
      <Plus />
    </Button>
    <Button size="icon-sm" variant="outline" aria-label="Delete">
      <Trash2 />
    </Button>
  </div>
)

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <Plus /> New lead
    </Button>
    <Button variant="outline">
      <Trash2 /> Remove outlet
    </Button>
    <Button variant="secondary">
      <Loader2 className="animate-spin" /> Syncing ClickUp
    </Button>
  </div>
)

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Submit ticket</Button>
    <Button variant="outline" disabled>
      Export CSV
    </Button>
    <Button variant="destructive" disabled>
      Delete lead
    </Button>
  </div>
)
