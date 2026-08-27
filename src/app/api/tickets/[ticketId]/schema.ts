import { z } from "zod"

import { TICKET_STATUSES } from "@/lib/ticket-statuses"

/**
 * PATCH body for a ticket update. Field shapes mirror the payload the
 * tickets UI sends; `status` is validated against the `tickets.status`
 * ENUM so free-form strings can no longer corrupt the column.
 */
export const ticketPatchSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  hidden: z.boolean().optional(),
  merchantName: z.string().optional(),
  customerPhone: z.string().optional(),
  fid: z.string().optional(),
  oid: z.string().optional(),
  category: z.string().optional(),
  subcategory1: z.string().optional(),
  subcategory2: z.string().nullish(),
  issueDescription: z.string().optional(),
  ticketDescription: z.string().nullish(),
  msPicUserId: z.string().nullish(),
  clickupTaskId: z.string().nullish(),
  clickupLink: z.string().nullish(),
  clickupTaskStatus: z.string().nullish(),
  clickupTaskStatusSyncedAt: z.string().nullish(),
  attend: z.boolean().optional(),
  merchantSentiment: z.string().nullish(),
})
