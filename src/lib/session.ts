"use client"

const SESSION_KEY = "sims-session"

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_TTL_MS = 7 * DAY_MS
const REMEMBER_TTL_MS = 30 * DAY_MS

export type SessionUser = {
  id: string
  name: string
  email: string
  department: string
  role: string
  avatarUrl?: string | null
  pageAccess?: string[]
}

type SessionPayload = {
  user: SessionUser
  expiresAt: number
  remember: boolean
}

function isPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") {
    return false
  }
  const payload = value as SessionPayload
  return (
    typeof payload.expiresAt === "number" &&
    payload.expiresAt > 0 &&
    typeof payload.user === "object" &&
    !!payload.user
  )
}

export function setSessionUser(user: SessionUser, remember: boolean) {
  if (typeof window === "undefined") {
    return
  }
  const ttl = remember ? REMEMBER_TTL_MS : DEFAULT_TTL_MS
  const payload: SessionPayload = {
    user,
    expiresAt: Date.now() + ttl,
    remember,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  window.dispatchEvent(new Event("sims-session-update"))
}

export function getSessionState() {
  if (typeof window === "undefined") {
    return null
  }

  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as SessionPayload
    if (!isPayload(parsed)) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch (error) {
    console.warn("Invalid session payload", error)
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function getSessionUser() {
  if (typeof window === "undefined") {
    return null
  }

  const payload = getSessionState()
  if (payload) {
    return payload.user
  }

  return null
}

export function clearSession() {
  if (typeof window === "undefined") {
    return
  }
  localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event("sims-session-update"))
}
