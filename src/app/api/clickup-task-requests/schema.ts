import { z } from "zod"

/**
 * Request-body schemas for the ClickUp task request routes. Fields stay
 * loose (`unknown`) on purpose: `validateCreatePayload` and the review
 * handler own the per-field checks and their exact error messages
 * ("Missing required fields.", "Invalid review action.", ...). The schemas
 * guarantee the body is a JSON object so malformed input fails with a 400
 * instead of an unhandled 500.
 */
export const clickupTaskRequestBodySchema = z.object({
  ticketId: z.unknown().optional(),
  fid: z.unknown().optional(),
  oid: z.unknown().optional(),
  franchiseName: z.unknown().optional(),
  product: z.unknown().optional(),
  departmentRequest: z.unknown().optional(),
  outletName: z.unknown().optional(),
  msPic: z.unknown().optional(),
  priorityLevel: z.unknown().optional(),
  severityLevel: z.unknown().optional(),
  incidentTitle: z.unknown().optional(),
  taskDescription: z.unknown().optional(),
  attachments: z.unknown().optional(),
})

/** Review decision body; the route validates `action` ("approve"/"reject"). */
export const clickupTaskReviewBodySchema = z.object({
  action: z.unknown().optional(),
  reason: z.unknown().optional(),
})
