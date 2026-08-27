import { z } from "zod"

/**
 * Shared request schemas for the user management routes. Fields mirror the
 * previous inline casts field-for-field: presence/shape is validated here,
 * while required-field, status, and authorization checks stay in the routes
 * so error messages and status codes are unchanged. `department` and `role`
 * derive from the existing `as const` tuples (single source of truth).
 */

export const departments = [
  "Merchant Success",
  "Sales & Marketing",
  "Renewal & Retention",
  "Product & Engineering",
  "General Operation",
] as const
export const roles = ["Super Admin", "Admin", "User"] as const

/** POST /api/users */
export const createUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  department: z.enum(departments).optional(),
  role: z.enum(roles).optional(),
  pageAccess: z.array(z.string()).optional(),
})

/** PATCH /api/users/[userId] */
export const updateUserSchema = z.object({
  action: z.literal("resend-activation").optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  department: z.enum(departments).optional(),
  role: z.enum(roles).optional(),
  password: z.string().optional(),
  status: z.string().optional(),
  pageAccess: z.array(z.string()).optional(),
})
