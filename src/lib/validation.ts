import type { NextResponse } from "next/server"
import { z } from "zod"

import { errorResponse } from "@/lib/api-errors"
import { parseObjectKey, type ParsedObjectKey } from "@/lib/storage-keys"

/**
 * Zod-based request validation helpers.
 *
 * Result shapes mirror the existing `"response" in auth` idiom used by the
 * route auth helpers, so validated routes read the same way:
 *
 *   const body = await parseJsonBody(request, schema)
 *   if (!body.ok) return body.response
 *   // body.data is fully typed
 *
 * Coexistence rule — derive, never duplicate: existing `as const` tuples
 * remain the single source of truth and Zod consumes them via
 * `z.enum(TUPLE)`. Route-specific schemas live in a `schema.ts` colocated
 * beside the `route.ts`; only cross-route primitives belong here.
 */

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) {
    return "Invalid request."
  }
  const path = issue.path.join(".")
  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Parse and validate a JSON request body. Malformed JSON and schema
 * violations both produce a 400 with the standard `{ error }` envelope
 * instead of an unhandled 500.
 */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema
): Promise<ParsedBody<z.output<Schema>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: errorResponse("Invalid JSON body.", 400) }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: errorResponse(firstIssueMessage(parsed.error), 400) }
  }
  return { ok: true, data: parsed.data }
}

/**
 * Validate URL search params. Repeated params collapse to the last value;
 * use an array schema with a preprocess step if a route ever needs
 * multi-value params.
 */
export function parseSearchParams<Schema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: Schema
): ParsedBody<z.output<Schema>> {
  const raw: Record<string, string> = {}
  for (const [key, value] of searchParams.entries()) {
    raw[key] = value
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: errorResponse(firstIssueMessage(parsed.error), 400) }
  }
  return { ok: true, data: parsed.data }
}

/**
 * Parse and validate a multipart/form-data body. File entries are passed
 * through as `File`; string entries as strings. Repeated fields collapse to
 * the last value.
 */
export async function parseFormData<Schema extends z.ZodType>(
  request: Request,
  schema: Schema
): Promise<ParsedBody<z.output<Schema>>> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return { ok: false, response: errorResponse("Invalid form data.", 400) }
  }

  const raw: Record<string, FormDataEntryValue> = {}
  for (const [key, value] of form.entries()) {
    raw[key] = value
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: errorResponse(firstIssueMessage(parsed.error), 400) }
  }
  return { ok: true, data: parsed.data }
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** A required, non-empty string, trimmed. */
export const trimmedString = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, { message: "Required." })

/**
 * Optional free text with `cleanString` semantics: non-strings and
 * empty/whitespace-only strings become `null`.
 */
export const optionalText = z
  .unknown()
  .transform((value) => {
    if (typeof value !== "string") {
      return null
    }
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  })

/** A required identifier: accepts strings and integers, yields a non-empty string. */
export const idString = z
  .union([z.string(), z.number().int()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0, { message: "Required." })

/**
 * A storage object key, validated through the single key grammar in
 * `storage-keys.ts`. Yields the parsed key.
 */
export const objectKeySchema: z.ZodType<ParsedObjectKey> = z
  .string()
  .transform((value, ctx) => {
    const parsed = parseObjectKey(value)
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Invalid object key." })
      return z.NEVER
    }
    return parsed
  })
