import { z } from "zod"

import { objectKeySchema } from "@/lib/validation"

/**
 * Shared request schema for the PLUS upload routes (cleanup, preview,
 * update, update/upload). The key validates through the single object-key
 * grammar and arrives parsed; ownership (isOwnObject) stays in the routes.
 */
export const plusUploadKeySchema = z.object({
  key: objectKeySchema.optional(),
})
