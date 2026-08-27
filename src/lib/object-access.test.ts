import assert from "node:assert/strict"
import test from "node:test"

import {
  canDeleteObject,
  classifyObjectRead,
  isOwnObject,
  readerReferenceSources,
} from "./object-access.ts"
import { parseObjectKey, type ParsedObjectKey } from "./storage-keys.ts"

function parsed(key: string): ParsedObjectKey {
  const result = parseObjectKey(key)
  assert.ok(result, `expected valid key: ${key}`)
  return result
}

const OWN_UPLOAD = parsed("uploads/42/1756270000000-1.xlsx")
const OTHERS_UPLOAD = parsed("uploads/7/1756270000000-1.pdf")
const PUBLIC_SUPPORT = parsed("support-form/public/1756270000000-1.png")
const OTHERS_AVATAR = parsed("avatars/7/1756270000000-1.png")

const owner = { id: "42", role: "Agent", pageAccess: [] as string[] }
const ticketsUser = { id: "9", role: "Agent", pageAccess: ["/tickets"] }
const noAccessUser = { id: "9", role: "Agent", pageAccess: [] as string[] }
const superAdmin = { id: "1", role: "Super Admin", pageAccess: [] as string[] }

test("own objects are always readable and deletable", () => {
  assert.equal(isOwnObject(owner, OWN_UPLOAD), true)
  assert.equal(classifyObjectRead(owner, OWN_UPLOAD), "allow")
  assert.equal(canDeleteObject(owner, OWN_UPLOAD), true)
})

test("public owner never counts as own", () => {
  assert.equal(isOwnObject({ id: "public" }, PUBLIC_SUPPORT), false)
  assert.equal(canDeleteObject(ticketsUser, PUBLIC_SUPPORT), false)
})

test("avatars are readable by any authenticated user", () => {
  assert.equal(classifyObjectRead(noAccessUser, OTHERS_AVATAR), "allow")
})

test("shared prefixes require a reader key, then a reference check", () => {
  assert.equal(classifyObjectRead(ticketsUser, PUBLIC_SUPPORT), "check-reference")
  assert.equal(classifyObjectRead(ticketsUser, OTHERS_UPLOAD), "check-reference")
  assert.equal(classifyObjectRead(noAccessUser, PUBLIC_SUPPORT), "deny")
  assert.equal(classifyObjectRead(noAccessUser, OTHERS_UPLOAD), "deny")
})

test("reference sources are scoped to the keys the user actually holds", () => {
  // A /tickets key must not unlock the onboarding attachment store. (It
  // does cover ClickUp task requests — the /clickup-tasks page itself
  // accepts the /tickets key in the page-access mappings.)
  assert.deepEqual(readerReferenceSources(ticketsUser, OTHERS_UPLOAD), [
    "tickets",
    "clickup-task-requests",
  ])
  assert.deepEqual(readerReferenceSources(ticketsUser, PUBLIC_SUPPORT), ["tickets"])

  const onboardingUser = {
    id: "9",
    role: "Agent",
    pageAccess: ["/onboarding-appointments"],
  }
  assert.deepEqual(readerReferenceSources(onboardingUser, OTHERS_UPLOAD), [
    "onboarding-appointments",
  ])
  // support-form attachments only surface on tickets — the onboarding key
  // grants nothing there.
  assert.deepEqual(readerReferenceSources(onboardingUser, PUBLIC_SUPPORT), [])
  assert.deepEqual(readerReferenceSources(noAccessUser, OTHERS_UPLOAD), [])
  assert.deepEqual(readerReferenceSources(ticketsUser, OTHERS_AVATAR), [])
})

test("super admin reads everything but still only deletes own objects", () => {
  assert.equal(classifyObjectRead(superAdmin, OTHERS_UPLOAD), "allow")
  assert.equal(canDeleteObject(superAdmin, OTHERS_UPLOAD), false)
})
