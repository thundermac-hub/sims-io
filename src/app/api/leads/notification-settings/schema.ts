import { z } from "zod"

/**
 * PATCH /api/leads/notification-settings. Mirrors the previous inline cast
 * field-for-field: presence/shape is validated here, while the enabled-flag
 * and recipient-email checks stay in the route so error messages and status
 * codes are unchanged.
 */
export const notificationSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  recipients: z.string().optional(),
})
