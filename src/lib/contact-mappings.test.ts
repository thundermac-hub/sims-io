import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyMappingConflict,
  formatMappingCount,
  groupMappingsByFranchise,
  isCoveredByFranchiseWide,
  summarizeMappings,
} from "./contact-mappings.ts"
import type { ContactMapping } from "./contact-mappings.ts"

const outletMapping = (
  id: string,
  franchiseId: string,
  outletId: string
): ContactMapping => ({
  id,
  franchiseId,
  outletId,
  franchiseName: `Franchise ${franchiseId}`,
  outletName: `Outlet ${outletId}`,
})

const franchiseWideMapping = (id: string, franchiseId: string): ContactMapping => ({
  id,
  franchiseId,
  outletId: null,
  franchiseName: `Franchise ${franchiseId}`,
  outletName: null,
})

test("allows a mapping that does not overlap anything existing", () => {
  const conflict = classifyMappingConflict(
    [outletMapping("1", "10442", "22318")],
    { franchiseId: "10871", outletId: "23901" }
  )

  assert.equal(conflict.reason, "none")
  assert.deepEqual(conflict.conflicting, [])
})

test("allows an outlet mapping under a franchise that has other outlets mapped", () => {
  const conflict = classifyMappingConflict(
    [outletMapping("1", "10233", "21004")],
    { franchiseId: "10233", outletId: "21008" }
  )

  assert.equal(conflict.reason, "none")
})

test("blocks re-adding the identical outlet mapping", () => {
  const existing = outletMapping("1", "10233", "21004")
  const conflict = classifyMappingConflict([existing], {
    franchiseId: "10233",
    outletId: "21004",
  })

  assert.equal(conflict.reason, "duplicate")
  assert.deepEqual(
    conflict.conflicting.map((mapping) => mapping.id),
    ["1"]
  )
})

test("blocks re-adding the identical franchise-wide mapping", () => {
  // The UNIQUE KEY cannot catch this: MySQL treats two NULL outlet_id values as
  // distinct, so the application layer is the only thing standing in the way.
  const conflict = classifyMappingConflict([franchiseWideMapping("1", "11007")], {
    franchiseId: "11007",
    outletId: null,
  })

  assert.equal(conflict.reason, "duplicate")
})

test("blocks an outlet mapping already covered by a franchise-wide mapping", () => {
  const conflict = classifyMappingConflict([franchiseWideMapping("1", "11007")], {
    franchiseId: "11007",
    outletId: "24118",
  })

  assert.equal(conflict.reason, "covered_by_franchise_wide")
  assert.deepEqual(
    conflict.conflicting.map((mapping) => mapping.id),
    ["1"]
  )
})

test("blocks a franchise-wide mapping when specific outlets already exist under it", () => {
  const conflict = classifyMappingConflict(
    [outletMapping("1", "10233", "21004"), outletMapping("2", "10233", "21008")],
    { franchiseId: "10233", outletId: null }
  )

  assert.equal(conflict.reason, "has_specific_outlets")
  assert.deepEqual(
    conflict.conflicting.map((mapping) => mapping.id),
    ["1", "2"]
  )
})

test("a franchise-wide mapping elsewhere does not block a specific outlet", () => {
  const conflict = classifyMappingConflict([franchiseWideMapping("1", "11007")], {
    franchiseId: "10233",
    outletId: "21004",
  })

  assert.equal(conflict.reason, "none")
})

test("isCoveredByFranchiseWide only reports the matching franchise", () => {
  const existing = [franchiseWideMapping("1", "11007"), outletMapping("2", "10233", "21004")]

  assert.equal(isCoveredByFranchiseWide(existing, "11007"), true)
  assert.equal(isCoveredByFranchiseWide(existing, "10233"), false)
  assert.equal(isCoveredByFranchiseWide(existing, "99999"), false)
})

test("groups mappings by franchise in first-seen order", () => {
  const groups = groupMappingsByFranchise([
    outletMapping("1", "10233", "21004"),
    franchiseWideMapping("2", "11007"),
    outletMapping("3", "10233", "21008"),
  ])

  assert.deepEqual(
    groups.map((group) => group.franchiseId),
    ["10233", "11007"]
  )
  assert.equal(groups[0].franchiseWide, false)
  assert.equal(groups[0].badge, "2 outlets")
  assert.equal(groups[1].franchiseWide, true)
  assert.equal(groups[1].badge, "Franchise-wide")
})

test("labels a franchise-wide row as covering every outlet", () => {
  const [group] = groupMappingsByFranchise([franchiseWideMapping("1", "11007")])

  assert.equal(group.rows[0].title, "All outlets under this franchise")
  assert.equal(group.rows[0].franchiseWide, true)
})

test("uses the singular badge for a lone outlet", () => {
  const [group] = groupMappingsByFranchise([outletMapping("1", "10233", "21004")])

  assert.equal(group.badge, "1 outlet")
  assert.equal(group.rows[0].subtitle, "OID 21004")
})

test("falls back to the outlet id when the outlet name is unresolved", () => {
  const [group] = groupMappingsByFranchise([
    { id: "1", franchiseId: "10233", outletId: "21004", outletName: null },
  ])

  assert.equal(group.rows[0].title, "Outlet 21004")
})

test("summarizes mixed mappings with both counts", () => {
  const summary = summarizeMappings([
    franchiseWideMapping("1", "11007"),
    outletMapping("2", "10233", "21004"),
    outletMapping("3", "10233", "21008"),
  ])

  assert.equal(summary, "1 franchise-wide mapping · 2 outlet mappings")
})

test("summarizes a contact with no mappings", () => {
  assert.equal(summarizeMappings([]), "No mappings yet")
})

test("formats the directory mapping count", () => {
  assert.equal(formatMappingCount(0), "Unmapped")
  assert.equal(formatMappingCount(1), "1 mapping")
  assert.equal(formatMappingCount(3), "3 mappings")
})
