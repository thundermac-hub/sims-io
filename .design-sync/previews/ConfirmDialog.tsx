import { ConfirmDialog } from "sims"

const noop = () => {}

export const Destructive = () => (
  <ConfirmDialog
    open
    onOpenChange={noop}
    onConfirm={noop}
    destructive
    title="Delete this lead?"
    description="Astoria Cafe and all of its activity history will be permanently removed. This cannot be undone."
    confirmLabel="Delete lead"
    cancelLabel="Keep lead"
  />
)
