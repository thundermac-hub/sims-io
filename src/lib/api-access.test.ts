import assert from "node:assert/strict"
import test from "node:test"

import { evaluateApiAccess } from "./api-access.ts"

const agent = { role: "User", pageAccess: ["/tickets"] }
const admin = { role: "Admin", pageAccess: ["/merchants"] }
const superAdmin = { role: "Super Admin", pageAccess: [] as string[] }

test("no options means authentication only", () => {
  assert.deepEqual(evaluateApiAccess(agent, {}), { allowed: true })
})

test("allowedPaths are OR-ed and resolved through the page-access mappings", () => {
  assert.deepEqual(
    evaluateApiAccess(agent, { allowedPaths: ["/tickets"] }),
    { allowed: true }
  )
  // /merchant-success/tickets maps to the /tickets key.
  assert.deepEqual(
    evaluateApiAccess(agent, { allowedPaths: ["/merchant-success/tickets"] }),
    { allowed: true }
  )
  assert.deepEqual(
    evaluateApiAccess(agent, { allowedPaths: ["/sales/leads", "/tickets"] }),
    { allowed: true }
  )
  const denied = evaluateApiAccess(agent, { allowedPaths: ["/sales/leads"] })
  assert.deepEqual(denied, { allowed: false, message: "Forbidden." })
})

test("requireRole checks after the path gate and Super Admin bypasses both", () => {
  assert.equal(
    evaluateApiAccess(agent, { allowedPaths: ["/tickets"], requireRole: "Admin" })
      .allowed,
    false
  )
  assert.equal(
    evaluateApiAccess(admin, { allowedPaths: ["/merchants"], requireRole: "Admin" })
      .allowed,
    true
  )
  assert.equal(
    evaluateApiAccess(superAdmin, {
      allowedPaths: ["/anything"],
      requireRole: "Admin",
    }).allowed,
    true
  )
})

test("path denial wins over the role message", () => {
  const denied = evaluateApiAccess(admin, {
    allowedPaths: ["/integrations"],
    requireRole: "Admin",
    roleErrorMessage: "Only an Admin can change integration secrets.",
  })
  assert.deepEqual(denied, { allowed: false, message: "Forbidden." })
})

test("custom role message is used for role denials", () => {
  const withKey = { role: "User", pageAccess: ["/integrations"] }
  const denied = evaluateApiAccess(withKey, {
    allowedPaths: ["/integrations"],
    requireRole: "Admin",
    roleErrorMessage: "Only an Admin can change integration secrets.",
  })
  assert.deepEqual(denied, {
    allowed: false,
    message: "Only an Admin can change integration secrets.",
  })
})
