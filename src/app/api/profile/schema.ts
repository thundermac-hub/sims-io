import { z } from "zod"

/**
 * PATCH /api/profile. Mirrors the previous inline cast field-for-field:
 * presence/shape is validated here, while required-field and password checks
 * stay in the route so error messages and status codes are unchanged.
 */
export const updateProfileSchema = z.object({
  name: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  avatarUrl: z.string().nullish(),
})
