import { z } from "zod"

/**
 * Shared request schema for the PLUS upload routes (cleanup, preview,
 * update/upload). Only the body shape is validated here — key grammar
 * (parseObjectKey) and ownership (isOwnObject) checks stay in the routes.
 */
export const plusUploadKeySchema = z.object({
  key: z.string().optional(),
})
