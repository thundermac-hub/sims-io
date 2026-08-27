import type { RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "./db.ts"
import { canAccessPath, SUPER_ADMIN_ROLE } from "./page-access.ts"
import { getProxyObjectUrl } from "./storage.ts"
import { parseObjectKey, type ParsedObjectKey } from "./storage-keys.ts"

/**
 * The ownership model for stored objects.
 *
 * Validate shape always (`parseObjectKey`), then authorize by class:
 *  - your own object is always readable and deletable;
 *  - avatars are readable by any authenticated user (they render all over
 *    the app);
 *  - anything else requires a shared-reader page key AND the key must be
 *    referenced by a record the holder of that key can already see —
 *    support-form attachments viewed by Merchant Success staff, onboarding
 *    attachments viewed by reviewers, ClickUp task-request attachments
 *    viewed by approvers.
 *
 * Callers must deny with 404, never 403 — a 403 confirms the object exists
 * and restores the enumeration oracle.
 */

export type ObjectAccessUser = {
  id: string
  role: string
  pageAccess: string[]
}

export function isOwnObject(
  user: Pick<ObjectAccessUser, "id">,
  parsed: ParsedObjectKey
): boolean {
  return parsed.owner !== "public" && parsed.owner === String(user.id)
}

export type ObjectReadDecision = "allow" | "deny" | "check-reference"

/** The record stores a shared read can be justified by. */
export type ReferenceSource =
  | "tickets"
  | "clickup-task-requests"
  | "onboarding-appointments"

/** The page key that makes a user a reader of each reference source. */
const SOURCE_READER_PATHS: Record<ReferenceSource, string> = {
  tickets: "/tickets",
  "clickup-task-requests": "/clickup-tasks",
  "onboarding-appointments": "/merchant-success/onboarding-appointments",
}

/**
 * The reference sources this user's page keys entitle them to read from,
 * for the given key's prefix. Pure — no database. Scoping the later
 * reference lookup to exactly these tables is what stops a /tickets key
 * from unlocking onboarding or ClickUp attachments it never covered.
 */
export function readerReferenceSources(
  user: ObjectAccessUser,
  parsed: ParsedObjectKey
): ReferenceSource[] {
  if (parsed.prefix === "avatars") {
    return []
  }
  const candidates: ReferenceSource[] =
    parsed.prefix === "support-form"
      ? ["tickets"]
      : ["tickets", "clickup-task-requests", "onboarding-appointments"]
  return candidates.filter((source) =>
    canAccessPath(user.role, user.pageAccess, SOURCE_READER_PATHS[source])
  )
}

/**
 * Pure classification — no database. "check-reference" means the caller
 * must confirm the key is referenced by a record in one of the user's
 * `readerReferenceSources` before allowing the read.
 */
export function classifyObjectRead(
  user: ObjectAccessUser,
  parsed: ParsedObjectKey
): ObjectReadDecision {
  if (user.role === SUPER_ADMIN_ROLE) {
    return "allow"
  }
  if (isOwnObject(user, parsed)) {
    return "allow"
  }
  if (parsed.prefix === "avatars") {
    return "allow"
  }

  return readerReferenceSources(user, parsed).length > 0
    ? "check-reference"
    : "deny"
}

/**
 * The stored forms a key can take in the database: the raw key
 * (attachment tables), the proxy URL (current attachment_url values), and
 * the legacy public MinIO URL (older attachment_url rows).
 */
function buildStoredValueCandidates(key: string): string[] {
  const candidates = [key, getProxyObjectUrl(key)]

  const bucket = process.env.MINIO_BUCKET
  const endpoint = process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT
  if (bucket && endpoint) {
    candidates.push(`${endpoint.replace(/\/$/, "")}/${bucket}/${key}`)
  }

  return candidates
}

async function isReferencedByRecord(
  parsed: ParsedObjectKey,
  sources: readonly ReferenceSource[]
): Promise<boolean> {
  if (sources.length === 0) {
    return false
  }

  const candidates = buildStoredValueCandidates(parsed.key)
  const placeholders = candidates.map(() => "?").join(", ")

  // Exact-match lookups (index-backed, never LIKE scans), scoped to the
  // tables the caller's page keys actually cover. OR over EXISTS lets the
  // optimizer stop at the first table that references the key.
  const clauses: string[] = []
  const params: string[] = []

  if (sources.includes("tickets")) {
    clauses.push(`EXISTS(
      SELECT 1 FROM tickets
      WHERE attachment_url IN (${placeholders})
         OR attachment_url_2 IN (${placeholders})
         OR attachment_url_3 IN (${placeholders})
    )`)
    params.push(...candidates, ...candidates, ...candidates)
  }
  if (sources.includes("clickup-task-requests")) {
    clauses.push(`EXISTS(
      SELECT 1 FROM clickup_task_requests
      WHERE attachment_url IN (${placeholders})
         OR attachment_url_2 IN (${placeholders})
         OR attachment_url_3 IN (${placeholders})
    )`)
    params.push(...candidates, ...candidates, ...candidates)
    clauses.push(`EXISTS(
      SELECT 1 FROM clickup_task_request_attachments
      WHERE storage_key IN (${placeholders})
    )`)
    params.push(...candidates)
  }
  if (sources.includes("onboarding-appointments")) {
    clauses.push(`EXISTS(
      SELECT 1 FROM onboarding_appointment_attachments
      WHERE storage_key IN (${placeholders})
    )`)
    params.push(...candidates)
  }

  const [rows] = await queryWithReconnect<Array<RowDataPacket & { hit: number }>>(
    `SELECT (${clauses.join(" OR ")}) AS hit`,
    params
  )
  return Number(rows[0]?.hit) === 1
}

/** Full read check: pure classification plus the reference lookup. */
export async function canReadObject(
  user: ObjectAccessUser,
  parsed: ParsedObjectKey
): Promise<boolean> {
  const decision = classifyObjectRead(user, parsed)
  if (decision === "allow") {
    return true
  }
  if (decision === "deny") {
    return false
  }
  return isReferencedByRecord(parsed, readerReferenceSources(user, parsed))
}

/**
 * Validate that every key in a submitted list is a well-formed object key
 * owned by the caller — the shared check for fresh attachment uploads.
 */
export function ownsAllObjectKeys(
  user: Pick<ObjectAccessUser, "id">,
  keys: readonly string[]
): boolean {
  return keys.every((key) => {
    const parsed = parseObjectKey(key)
    return parsed !== null && isOwnObject(user, parsed)
  })
}

/** Deletion never crosses users: own-object only. */
export function canDeleteObject(
  user: Pick<ObjectAccessUser, "id">,
  parsed: ParsedObjectKey
): boolean {
  return isOwnObject(user, parsed)
}
