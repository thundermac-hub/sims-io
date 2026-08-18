/**
 * Cookie persistence for the Contacts directory filters.
 *
 * Follows the repo's UI-state convention: `<context>_<thing>` name, `Path=/`, a 12-hour
 * `Max-Age` for volatile filters, and read client-side from `document.cookie` in a lazy
 * `useState` initialiser (not an effect) so the persisted value is applied on first
 * render with no unfiltered flash. Never `localStorage` — that is reserved for the
 * session user cache.
 *
 * Modelled on `sales/deals/date-filter-state.ts`.
 */

export const CONTACTS_FILTER_COOKIE = "contacts_directory_filter"

const MAX_AGE_SECONDS = 60 * 60 * 12

export type ContactsFilterState = {
  franchiseId: string
  outletId: string
  role: string
}

export const EMPTY_CONTACTS_FILTER: ContactsFilterState = {
  franchiseId: "",
  outletId: "",
  role: "",
}

const FILTER_KEYS = Object.keys(EMPTY_CONTACTS_FILTER) as (keyof ContactsFilterState)[]

export function countActiveContactsFilters(filters: ContactsFilterState): number {
  return FILTER_KEYS.filter((key) => Boolean(filters[key])).length
}

export function parseContactsFilterCookie(
  value: string | null | undefined
): ContactsFilterState {
  if (!value) {
    return EMPTY_CONTACTS_FILTER
  }

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value))
    if (!parsed || typeof parsed !== "object") {
      return EMPTY_CONTACTS_FILTER
    }

    const record = parsed as Record<string, unknown>
    const next = { ...EMPTY_CONTACTS_FILTER }
    for (const key of FILTER_KEYS) {
      const candidate = record[key]
      if (typeof candidate === "string") {
        next[key] = candidate
      }
    }
    return next
  } catch {
    // A malformed cookie is not worth surfacing; fall back to no filters.
    return EMPTY_CONTACTS_FILTER
  }
}

export function readContactsFilterCookie(): ContactsFilterState {
  if (typeof document === "undefined") {
    return EMPTY_CONTACTS_FILTER
  }

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CONTACTS_FILTER_COOKIE}=`))

  return parseContactsFilterCookie(match?.slice(CONTACTS_FILTER_COOKIE.length + 1))
}

export function writeContactsFilterCookie(filters: ContactsFilterState): void {
  if (typeof document === "undefined") {
    return
  }

  if (!countActiveContactsFilters(filters)) {
    document.cookie = `${CONTACTS_FILTER_COOKIE}=; Max-Age=0; Path=/`
    return
  }

  const value = encodeURIComponent(JSON.stringify(filters))
  document.cookie = `${CONTACTS_FILTER_COOKIE}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/`
}
