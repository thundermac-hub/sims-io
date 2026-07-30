import assert from "node:assert/strict"
import test from "node:test"

import {
  canCommentOnProject,
  canEditProject,
  canManageMembers,
  canTransferOwnership,
  canViewProject,
  isAssignableProjectRole,
  isProjectRole,
  resolveEffectiveRole,
  validateProjectInput,
} from "./projects.ts"

test("resolveEffectiveRole returns the membership role when one exists", () => {
  assert.equal(resolveEffectiveRole("Owner", "User"), "Owner")
  assert.equal(resolveEffectiveRole("Editor", "Admin"), "Editor")
  assert.equal(resolveEffectiveRole("Viewer", "Super Admin"), "Viewer")
})

test("resolveEffectiveRole grants a Super Admin read-only visibility", () => {
  assert.equal(resolveEffectiveRole(null, "Super Admin"), "SuperAdminReadOnly")
})

test("resolveEffectiveRole denies non-members who are not Super Admin", () => {
  assert.equal(resolveEffectiveRole(null, "Admin"), null)
  assert.equal(resolveEffectiveRole(null, "User"), null)
})

test("only members and read-only Super Admins can view", () => {
  assert.equal(canViewProject("Owner"), true)
  assert.equal(canViewProject("Editor"), true)
  assert.equal(canViewProject("Viewer"), true)
  assert.equal(canViewProject("SuperAdminReadOnly"), true)
  assert.equal(canViewProject(null), false)
})

test("only Owner and Editor can change project content", () => {
  assert.equal(canEditProject("Owner"), true)
  assert.equal(canEditProject("Editor"), true)
  assert.equal(canEditProject("Viewer"), false)
  assert.equal(canEditProject("SuperAdminReadOnly"), false)
  assert.equal(canEditProject(null), false)
})

test("Viewers can comment but a read-only Super Admin cannot", () => {
  assert.equal(canCommentOnProject("Viewer"), true)
  assert.equal(canCommentOnProject("Owner"), true)
  assert.equal(canCommentOnProject("Editor"), true)
  assert.equal(canCommentOnProject("SuperAdminReadOnly"), false)
  assert.equal(canCommentOnProject(null), false)
})

test("membership management is Owner or Editor; transfer is Owner only", () => {
  assert.equal(canManageMembers("Owner"), true)
  assert.equal(canManageMembers("Editor"), true)
  assert.equal(canManageMembers("Viewer"), false)
  assert.equal(canManageMembers("SuperAdminReadOnly"), false)

  assert.equal(canTransferOwnership("Owner"), true)
  assert.equal(canTransferOwnership("Editor"), false)
  assert.equal(canTransferOwnership("SuperAdminReadOnly"), false)
})

test("role guards accept known values only", () => {
  assert.equal(isProjectRole("Owner"), true)
  assert.equal(isProjectRole("owner"), false)
  assert.equal(isAssignableProjectRole("Editor"), true)
  // Ownership is never handed out through the members endpoints.
  assert.equal(isAssignableProjectRole("Owner"), false)
})

test("validateProjectInput accepts a well-formed payload", () => {
  const result = validateProjectInput({
    name: "  Onboarding revamp  ",
    description: "  Rework the flow  ",
    startDate: "2026-08-01",
  })
  assert.deepEqual(result, {
    ok: true,
    value: {
      name: "Onboarding revamp",
      description: "Rework the flow",
      startDate: "2026-08-01",
    },
  })
})

test("validateProjectInput treats a blank description as null", () => {
  const result = validateProjectInput({
    name: "Project",
    description: "   ",
    startDate: "2026-08-01",
  })
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.value.description, null)
})

test("validateProjectInput rejects a missing or oversized name", () => {
  assert.equal(
    validateProjectInput({ name: "  ", startDate: "2026-08-01" }).ok,
    false
  )
  assert.equal(
    validateProjectInput({ name: "a".repeat(161), startDate: "2026-08-01" }).ok,
    false
  )
})

test("validateProjectInput rejects malformed and impossible start dates", () => {
  for (const startDate of ["", "01-08-2026", "2026-8-1", "2026-13-01", "not a date"]) {
    assert.equal(
      validateProjectInput({ name: "Project", startDate }).ok,
      false,
      `expected ${JSON.stringify(startDate)} to be rejected`
    )
  }
})

test("validateProjectInput rejects a non-object body", () => {
  assert.equal(validateProjectInput(null).ok, false)
  assert.equal(validateProjectInput("nope").ok, false)
})
