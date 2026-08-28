import { z } from "zod"

/**
 * Request schemas for /api/ticket-categories. These mirror the previous
 * inline casts field-for-field; required-field checks and normalization
 * stay in the route so error messages are unchanged.
 */

/** POST /api/ticket-categories */
export const createCategorySchema = z.object({
  name: z.string().optional(),
  parentId: z.string().nullish(),
  sortOrder: z.number().optional(),
})

/** PATCH /api/ticket-categories */
export const updateCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  sortOrder: z.number().optional(),
})
