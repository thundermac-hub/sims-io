import { z } from "zod"

/**
 * Shared request schemas for the public auth routes. These mirror the
 * previous inline casts field-for-field: presence/shape is validated here,
 * while required-field and business checks stay in the routes so error
 * messages and status codes are unchanged.
 */

/** POST /api/auth/login */
export const loginSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  remember: z.boolean().optional(),
})

/** POST /api/auth/activate and /api/auth/reset-password */
export const tokenPasswordSchema = z.object({
  token: z.string().optional(),
  password: z.string().optional(),
})

/** POST /api/auth/forgot-password */
export const forgotPasswordSchema = z.object({
  email: z.string().optional(),
})
