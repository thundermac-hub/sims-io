import { z } from "zod"

import { ACTIVITY_TYPES } from "@/lib/lead-activities"
import { LEAD_STATUSES } from "@/lib/leads"

/**
 * Request-body schemas for the lead routes. Most fields stay loose
 * (`unknown`) on purpose: the handlers keep their hand-rolled checks
 * (`cleanString`, `parseOptionalUserId`, `validateActivityInput`, ...) and
 * exact error messages. Tuple-backed discriminators derive from the
 * existing `as const` tuples via `z.enum`; they are `nullish` because the
 * handlers treat `null` like an absent value (default, fall back to the
 * existing row, or reject with their own message). The schemas guarantee
 * the body is a JSON object so malformed input fails with a 400 instead of
 * an unhandled 500.
 */

export const manualLeadSchema = z.object({
  name: z.unknown().optional(),
  telephone: z.unknown().optional(),
  email: z.unknown().optional(),
  businessName: z.unknown().optional(),
  businessType: z.unknown().optional(),
  businessLocation: z.unknown().optional(),
  assignedUserId: z.unknown().optional(),
})

export const leadPatchSchema = z.object({
  archived: z.unknown().optional(),
  name: z.unknown().optional(),
  telephone: z.unknown().optional(),
  email: z.unknown().optional(),
  businessName: z.unknown().optional(),
  businessType: z.unknown().optional(),
  businessLocation: z.unknown().optional(),
  status: z.enum(LEAD_STATUSES).nullish(),
  assignedUserId: z.unknown().optional(),
})

export const patchActivitySchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES).nullish(),
  activityDate: z.unknown().optional(),
  remarks: z.unknown().optional(),
  callOutcome: z.unknown().optional(),
  callDirection: z.unknown().optional(),
  meetingOutcome: z.unknown().optional(),
  locationType: z.unknown().optional(),
  location: z.unknown().optional(),
  googlePlaceId: z.unknown().optional(),
  googleMapsUri: z.unknown().optional(),
  locationLat: z.unknown().optional(),
  locationLng: z.unknown().optional(),
  dealId: z.unknown().optional(),
})

export const createActivitySchema = patchActivitySchema.extend({
  createAppointment: z.unknown().optional(),
  participantEmails: z.unknown().optional(),
})
