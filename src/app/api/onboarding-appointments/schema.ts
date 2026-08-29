import { z } from "zod"

/**
 * Request-body schemas for the onboarding appointment routes. Fields stay
 * loose (`unknown`) on purpose: the handlers keep their hand-rolled checks
 * (`cleanString`, `isInstallationType`, `isPaymentStatus`, ...) and exact
 * error messages ("Missing required appointment fields.", "Invalid
 * installation type.", ...). The schemas guarantee the body is a JSON
 * object so malformed input fails with a 400 instead of an unhandled 500,
 * and they preserve key presence for the `Object.hasOwn` checks in PATCH.
 */
export const createOnboardingAppointmentSchema = z.object({
  outletName: z.unknown().optional(),
  installationType: z.unknown().optional(),
  scheduledAt: z.unknown().optional(),
  scheduledEndAt: z.unknown().optional(),
  paymentStatus: z.unknown().optional(),
  locationName: z.unknown().optional(),
  locationAddress: z.unknown().optional(),
  googlePlaceId: z.unknown().optional(),
  googleMapsUri: z.unknown().optional(),
  locationLat: z.unknown().optional(),
  locationLng: z.unknown().optional(),
  attachmentKeys: z.unknown().optional(),
  attachmentNames: z.unknown().optional(),
})

export const updateOnboardingAppointmentSchema = createOnboardingAppointmentSchema
  .omit({ attachmentKeys: true, attachmentNames: true })
  .extend({
    existingAttachmentKeys: z.unknown().optional(),
    newAttachmentKeys: z.unknown().optional(),
    newAttachmentNames: z.unknown().optional(),
    assignedMsUserId: z.unknown().optional(),
  })

export const reviewOnboardingAppointmentSchema = z.object({
  action: z.unknown().optional(),
  reason: z.unknown().optional(),
  assignedMsUserId: z.unknown().optional(),
})

export const cancelOnboardingAppointmentSchema = z.object({
  reason: z.unknown().optional(),
})
