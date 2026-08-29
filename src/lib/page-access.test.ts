import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessAnyPath,
  canAccessPath,
  GENERAL_OVERVIEW_PATH,
  getAccessKeysForPath,
  hasPageAccessForPath,
  hasUniversalAccess,
  SUPER_ADMIN_ROLE,
} from "./page-access.ts"

test("universal paths are open to every authenticated user", () => {
  assert.equal(hasUniversalAccess(GENERAL_OVERVIEW_PATH), true)
  assert.equal(hasUniversalAccess("/release-notes/1.2.3"), true)
  assert.equal(hasUniversalAccess("/tickets"), false)
  assert.equal(hasPageAccessForPath("/overview", []), true)
})

test("a person can always reach their own profile and preferences", () => {
  // Linked from the user dropdown for everyone; no grant exists for them in
  // user-management, so requiring a key locked out every non-Super-Admin.
  for (const path of ["/profile", "/preferences"]) {
    assert.equal(hasUniversalAccess(path), true, path)
    assert.equal(hasPageAccessForPath(path, []), true, path)
    assert.equal(canAccessPath("User", [], path), true, path)
    assert.equal(canAccessPath("Admin", [], path), true, path)
  }
})

test("longest prefix wins in the route mappings", () => {
  assert.deepEqual(getAccessKeysForPath("/merchant-success/tickets"), ["/tickets"])
  assert.deepEqual(getAccessKeysForPath("/merchant-success"), ["/merchant-success"])
  assert.deepEqual(getAccessKeysForPath("/sales/overview"), ["/sales/overview"])
  // Legacy workspace-level grant.
  assert.deepEqual(getAccessKeysForPath("/sales"), ["/sales"])
})

test("mapped paths accept any of their access keys", () => {
  assert.equal(
    hasPageAccessForPath("/merchant-success/csat-insights", ["/analytics"]),
    true
  )
  assert.equal(
    hasPageAccessForPath("/merchant-success/csat-insights", ["/csat-insights"]),
    true
  )
  assert.equal(hasPageAccessForPath("/merchant-success/csat-insights", []), false)
})

test("unmapped paths fall back to prefix matching against the grants", () => {
  assert.equal(hasPageAccessForPath("/some/new/page", ["/some"]), true)
  assert.equal(hasPageAccessForPath("/some/new/page", ["/other"]), false)
})

test("canAccessPath centralizes the Super Admin bypass", () => {
  assert.equal(canAccessPath(SUPER_ADMIN_ROLE, [], "/tickets"), true)
  assert.equal(canAccessPath("User", [], "/tickets"), false)
  assert.equal(canAccessPath("User", ["/tickets"], "/tickets"), true)
})

test("canAccessAnyPath ORs over paths", () => {
  assert.equal(
    canAccessAnyPath("User", ["/tickets"], ["/sales/leads", "/tickets"]),
    true
  )
  assert.equal(canAccessAnyPath("User", ["/tickets"], ["/sales/leads"]), false)
  assert.equal(canAccessAnyPath("User", ["/tickets"], []), false)
})

test("trailing slashes normalize", () => {
  assert.equal(hasPageAccessForPath("/tickets/", ["/tickets"]), true)
})
