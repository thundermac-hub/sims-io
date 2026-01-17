import { randomUUID } from "crypto"

import getPool from "@/lib/db"

type PosMerchant = Record<string, unknown>

type ImportSummary = {
  imported: number
  pages: number
  completedAt: string
}

const DEFAULT_AUTH_URL = "https://api.getslurp.com/api/login"
const DEFAULT_IMPORT_URL = "http://api.getslurp.com/api/franchise-retrieve/"

function resolveAuthUrl() {
  return process.env.POS_AUTH_URL || DEFAULT_AUTH_URL
}

function resolveImportUrl() {
  return process.env.POS_IMPORT_URL || DEFAULT_IMPORT_URL
}

function resolveCredentials() {
  const email = process.env.POS_API_EMAIL
  const password = process.env.POS_API_PASSWORD
  if (!email || !password) {
    throw new Error("POS_API_EMAIL and POS_API_PASSWORD are required")
  }
  return { email, password }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const tokenKeys = [
  "token",
  "access_token",
  "accessToken",
  "jwt",
  "jwt_token",
  "id_token",
  "auth_token",
  "api_token",
] as const

function readTokenFromRecord(record: Record<string, unknown>) {
  for (const key of tokenKeys) {
    const value = record[key]
    if (typeof value === "string") {
      return value
    }
    if (isRecord(value)) {
      const nested = value as Record<string, unknown>
      for (const nestedKey of ["token", "access", "access_token", "value"]) {
        const nestedValue = nested[nestedKey]
        if (typeof nestedValue === "string") {
          return nestedValue
        }
      }
    }
  }
  return null
}

function extractToken(payload: unknown, headers?: Headers) {
  if (!isRecord(payload)) {
    if (!headers) {
      return null
    }
  }
  if (isRecord(payload)) {
    const directToken = readTokenFromRecord(payload)
    if (directToken) {
      return directToken
    }
    const data = payload.data
    if (isRecord(data)) {
      const nestedToken = readTokenFromRecord(data)
      if (nestedToken) {
        return nestedToken
      }
    }
    const result = payload.result ?? payload.results
    if (isRecord(result)) {
      const resultToken = readTokenFromRecord(result)
      if (resultToken) {
        return resultToken
      }
    }
  }

  if (headers) {
    const headerKeys = [
      "authorization",
      "Authorization",
      "x-access-token",
      "x-auth-token",
      "x-token",
    ]
    for (const key of headerKeys) {
      const value = headers.get(key)
      if (value) {
        return value.startsWith("Bearer ") ? value.slice(7) : value
      }
    }
  }

  return null
}

function getItems(payload: unknown) {
  if (!payload) {
    return []
  }
  if (Array.isArray(payload)) {
    return payload
  }
  if (!isRecord(payload)) {
    return []
  }
  const candidates = [
    payload.data,
    payload.results,
    payload.items,
    isRecord(payload.data) ? payload.data.items : undefined,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }
  return []
}

function getName(item: PosMerchant) {
  return (
    (item.name as string) ||
    (item.franchise_name as string) ||
    (item.business_name as string) ||
    "Unknown Merchant"
  )
}

function getExternalId(item: PosMerchant) {
  return String(
    item.id ??
      item.fid ??
      item.franchise_id ??
      item.code ??
      getName(item)
  )
}

function getOutletCount(item: PosMerchant) {
  const outlets = item.outlets
  if (Array.isArray(outlets)) {
    return outlets.length
  }
  if (outlets && typeof outlets === "object") {
    return 1
  }
  const value =
    (outlets as number) ||
    (item.outlet_count as number) ||
    (item.outletCount as number) ||
    0
  return Number.isFinite(value) ? Number(value) : 0
}

function getStatus(item: PosMerchant) {
  const value =
    item.status ?? item.state ?? item.lifecycle ?? item.status_code ?? null
  if (typeof value === "number") {
    if (value === 1) {
      return "Active"
    }
    if (value === 0) {
      return "Inactive"
    }
    return String(value)
  }
  return (value as string) || null
}

function getOutlets(item: PosMerchant) {
  const outlets = item.outlets
  if (Array.isArray(outlets)) {
    return outlets as PosMerchant[]
  }
  if (outlets && typeof outlets === "object") {
    return [outlets as PosMerchant]
  }
  return []
}

function getOutletExternalId(outlet: PosMerchant) {
  return String(
    outlet.id ??
      outlet.oid ??
      outlet.outlet_id ??
      outlet.code ??
      outlet.outlet_code ??
      ""
  )
}

function getOutletName(outlet: PosMerchant) {
  return (
    (outlet.name as string) ||
    (outlet.outlet_name as string) ||
    (outlet.title as string) ||
    "Unknown Outlet"
  )
}

async function fetchImportWithToken(url: URL, token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Api-Token": token,
    "X-Api-Key": token,
  }

  let response = await fetch(url.toString(), { headers })
  if (response.status !== 401) {
    return response
  }

  const retryUrl = new URL(url.toString())
  retryUrl.searchParams.set("api_token", token)
  retryUrl.searchParams.set("token", token)

  response = await fetch(retryUrl.toString(), {
    headers: {
      ...headers,
      Authorization: `Token ${token}`,
    },
  })

  return response
}

export async function runMerchantImport(trigger: "manual" | "cron") {
  const pool = getPool()
  const runId = randomUUID()
  await pool.query(
    `
    INSERT INTO merchant_import_runs (id, status, started_at)
    VALUES (?, 'running', CURRENT_TIMESTAMP)
  `,
    [runId]
  )

  let imported = 0
  let pages = 0

  try {
    const { email, password } = resolveCredentials()
    const authResponse = await fetch(resolveAuthUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!authResponse.ok) {
      throw new Error(`Auth failed with status ${authResponse.status}`)
    }

    const authPayload = await authResponse.json()
    const token = extractToken(authPayload, authResponse.headers)
    if (!token) {
      const payloadKeys = isRecord(authPayload)
        ? Object.keys(authPayload).join(", ")
        : "unknown"
      throw new Error(
        `Auth response did not include a token (keys: ${payloadKeys}).`
      )
    }

    const perPage = 100
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = new URL(resolveImportUrl())
      url.searchParams.set("per_page", String(perPage))
      url.searchParams.set("page", String(page))

      const response = await fetchImportWithToken(url, token)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "")
        const details = errorBody ? ` - ${errorBody}` : ""
        throw new Error(`Import failed with status ${response.status}${details}`)
      }

      const payload = await response.json()
      const items = getItems(payload) as PosMerchant[]
      pages += 1

      if (!items.length) {
        hasMore = false
        break
      }

      for (const item of items) {
        const externalId = String(getExternalId(item))
        const name = getName(item)
        const fid =
          (item.id as string) ||
          (item.fid as string) ||
          (item.franchise_id as string) ||
          null
        const outletCount = getOutletCount(item)
        const status = getStatus(item)

        await pool.query(
          `
          INSERT INTO merchants (id, external_id, name, fid, outlet_count, status, raw_payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            fid = VALUES(fid),
            outlet_count = VALUES(outlet_count),
            status = VALUES(status),
            raw_payload = VALUES(raw_payload),
            updated_at = CURRENT_TIMESTAMP
        `,
          [
            randomUUID(),
            externalId,
            name,
            fid,
            outletCount,
            status,
            JSON.stringify(item),
          ]
        )

        const outlets = getOutlets(item)
        for (const outlet of outlets) {
          const outletExternalId = getOutletExternalId(outlet)
          if (!outletExternalId) {
            continue
          }
          const outletName = getOutletName(outlet)
          const outletStatus = getStatus(outlet)

          await pool.query(
            `
            INSERT INTO merchant_outlets (
              id,
              external_id,
              merchant_external_id,
              name,
              status,
              raw_payload
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              merchant_external_id = VALUES(merchant_external_id),
              name = VALUES(name),
              status = VALUES(status),
              raw_payload = VALUES(raw_payload),
              updated_at = CURRENT_TIMESTAMP
          `,
            [
              randomUUID(),
              outletExternalId,
              externalId,
              outletName,
              outletStatus,
              JSON.stringify(outlet),
            ]
          )
        }
        imported += 1
      }

      await pool.query(
        `
        UPDATE merchant_import_runs
        SET records_imported = ?
        WHERE id = ?
      `,
        [imported, runId]
      )

      if (items.length < perPage) {
        hasMore = false
      } else {
        page += 1
      }
    }

    await pool.query(
      `
      UPDATE merchant_import_runs
      SET status = 'success',
          completed_at = CURRENT_TIMESTAMP,
          records_imported = ?
      WHERE id = ?
    `,
      [imported, runId]
    )

    const [rows] = await pool.query(
      `
      SELECT completed_at
      FROM merchant_import_runs
      WHERE id = ?
    `,
      [runId]
    )
    const completedAt = (rows as Array<{ completed_at: string }>)[0]
      ?.completed_at

    return {
      imported,
      pages,
      completedAt: completedAt ?? new Date().toISOString(),
      trigger,
    } satisfies ImportSummary & { trigger: string }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await pool.query(
      `
      UPDATE merchant_import_runs
      SET status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          error_message = ?
      WHERE id = ?
    `,
      [message, runId]
    )
    throw error
  }
}
