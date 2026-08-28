import { z } from "zod"

/**
 * Request-body schemas for the sales appointment routes. Fields stay loose
 * (`unknown`) on purpose: the handlers keep their hand-rolled checks
 * (`cleanString`, `isAppointmentType`, `parseOptionalCoordinate`, ...) and
 * exact error messages ("Missing required appointment fields.", "Invalid
 * appointment type.", ...). The schemas guarantee the body is a JSON
 * object so malformed input fails with a 400 instead of an unhandled 500,
 * and they preserve key presence for the `Object.hasOwn` checks in PATCH.
 */
export const salesAppointmentBodySchema = z.object({
  leadId: z.unknown().optional(),
  customerName: z.unknown().optional(),
  businessName: z.unknown().optional(),
  businessType: z.unknown().optional(),
  businessLocation: z.unknown().optional(),
  meetingLocation: z.unknown().optional(),
  googlePlaceId: z.unknown().optional(),
  googleMapsUri: z.unknown().optional(),
  locationLat: z.unknown().optional(),
  locationLng: z.unknown().optional(),
  participantEmails: z.unknown().optional(),
  appointmentType: z.unknown().optional(),
  scheduledAt: z.unknown().optional(),
})

export const completeSalesAppointmentSchema = z.object({
  reason: z.unknown().optional(),
})

export const cancelSalesAppointmentSchema = z.object({
  reason: z.unknown().optional(),
})
