import type { RowDataPacket } from "mysql2/promise"

import { queryWithReconnect } from "./db.ts"
import { canAccessAnyPath, SUPER_ADMIN_ROLE } from "./page-access.ts"
import { getProxyObjectUrl } from "./storage.ts"
import type { ParsedObjectKey } from "./storage-keys.ts"

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

/** Route paths whose page keys make a user a shared reader of a prefix. */
const SHARED_READER_PATHS: Record<ParsedObjectKey["prefix"], readonly string[]> = {
  // Avatars are handled before this table is consulted.
  avatars: [],
  // Support-form attachments surface on tickets.
  "support-form": ["/tickets"],
  // Staff uploads surface on tickets, ClickUp task requests, and
  // onboarding appointments.
  uploads: [
    "/tickets",
    "/clickup-tasks",
    "/merchant-success/onboarding-appointments",
  ],
}

/**
 * Pure classification — no database. "check-reference" means the caller
 * must confirm the key is referenced by a record before allowing the read.
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

  const readerPaths = SHARED_READER_PATHS[parsed.prefix]
  if (
    readerPaths.length > 0 &&
    canAccessAnyPath(user.role, user.pageAccess, readerPaths)
  ) {
    return "check-reference"
  }
  return "deny"
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

async function isReferencedByRecord(parsed: ParsedObjectKey): Promise<boolean> {
  const candidates = buildStoredValueCandidates(parsed.key)
  const placeholders = candidates.map(() => "?").join(", ")

  // Exact-match lookups (index-backed) — never LIKE scans.
  const [rows] = await queryWithReconnect<Array<RowDataPacket & { hit: number }>>(
    `
    SELECT 1 AS hit FROM tickets
      WHERE attachment_url IN (${placeholders})
         OR attachment_url_2 IN (${placeholders})
         OR attachment_url_3 IN (${placeholders})
      LIMIT 1
    UNION ALL
    SELECT 1 AS hit FROM clickup_task_requests
      WHERE attachment_url IN (${placeholders})
         OR attachment_url_2 IN (${placeholders})
         OR attachment_url_3 IN (${placeholders})
      LIMIT 1
    UNION ALL
    SELECT 1 AS hit FROM clickup_task_request_attachments
      WHERE storage_key IN (${placeholders})
      LIMIT 1
    UNION ALL
    SELECT 1 AS hit FROM onboarding_appointment_attachments
      WHERE storage_key IN (${placeholders})
      LIMIT 1
    `,
    [
      ...candidates,
      ...candidates,
      ...candidates,
      ...candidates,
      ...candidates,
      ...candidates,
      ...candidates,
      ...candidates,
    ]
  )
  return rows.length > 0
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
  return isReferencedByRecord(parsed)
}

/** Deletion never crosses users: own-object only. */
export function canDeleteObject(
  user: Pick<ObjectAccessUser, "id">,
  parsed: ParsedObjectKey
): boolean {
  return isOwnObject(user, parsed)
}
