/**
 * Canonical ticket workflow statuses — the single source of truth mirroring
 * the `tickets.status` ENUM in `schema.sql`. Zod schemas consume the tuple
 * via `z.enum(TICKET_STATUSES)`; never duplicate the literals.
 */
export const TICKET_STATUSES = [
  "Open",
  "In Progress",
  "Pending Customer",
  "Resolved",
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]
