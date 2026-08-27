import { z } from "zod"

/**
 * Shared request schemas for the Google Places proxy routes. Fields are
 * accepted as `unknown` and narrowed in the routes (matching the previous
 * inline casts) so downstream behavior is unchanged.
 */

/**
 * Every UI surface that renders the location picker. Both proxy routes
 * gate on this one list so a new picker surface is a one-place change.
 */
export const LOCATION_PICKER_PATHS = [
  "/sales/appointments",
  "/sales/leads",
  "/merchants",
  "/contacts",
  "/merchant-success/onboarding-appointments",
] as const

/** POST /api/google-places/autocomplete */
export const autocompleteSchema = z.object({
  input: z.unknown().optional(),
  sessionToken: z.unknown().optional(),
})

/** POST /api/google-places/details */
export const placeDetailsSchema = z.object({
  placeId: z.unknown().optional(),
  sessionToken: z.unknown().optional(),
})
