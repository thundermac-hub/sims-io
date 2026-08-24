import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOutletChoices,
  describeOutletChoice,
  franchiseWideIds,
  spansMultipleFranchises,
} from "./ticket-outlet-choices.ts"
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

test("offers each outlet-specific mapping as a choice", () => {
  const choices = buildOutletChoices(
    [outletMapping("1", "10442", "22318"), outletMapping("2", "10442", "22319")],
    {}
  )

  assert.deepEqual(
    choices.map((choice) => choice.value),
    ["10442:22318", "10442:22319"]
  )
  assert.equal(choices[0].source, "outlet_mapping")
  assert.equal(choices[0].outletName, "Outlet 22318")
})

test("expands a franchise-wide mapping into the franchise's outlets", () => {
  const choices = buildOutletChoices([franchiseWideMapping("1", "11007")], {
    "11007": [
      { externalId: "24118", name: "Bangsar" },
      { externalId: "24119", name: "Mont Kiara" },
    ],
  })

  assert.deepEqual(
    choices.map((choice) => [choice.outletId, choice.outletName, choice.source]),
    [
      ["24118", "Bangsar", "franchise_wide"],
      ["24119", "Mont Kiara", "franchise_wide"],
    ]
  )
})

test("yields nothing for a franchise-wide mapping whose outlets are not loaded yet", () => {
  assert.deepEqual(buildOutletChoices([franchiseWideMapping("1", "11007")], {}), [])
})

test("still offers outlet-specific mappings when a franchise-wide list is missing", () => {
  const choices = buildOutletChoices(
    [franchiseWideMapping("1", "11007"), outletMapping("2", "10442", "22318")],
    {}
  )

  assert.deepEqual(
    choices.map((choice) => choice.value),
    ["10442:22318"]
  )
})

test("collapses an outlet reachable both franchise-wide and specifically", () => {
  const choices = buildOutletChoices(
    [franchiseWideMapping("1", "11007"), outletMapping("2", "11007", "24118")],
    { "11007": [{ externalId: "24118", name: "Bangsar" }] }
  )

  assert.equal(choices.length, 1)
  assert.equal(choices[0].source, "franchise_wide")
})

test("keeps choices from different franchises apart", () => {
  const choices = buildOutletChoices(
    [outletMapping("1", "10233", "21004"), outletMapping("2", "10688", "23901")],
    {}
  )

  assert.equal(choices.length, 2)
  assert.equal(spansMultipleFranchises(choices), true)
})

test("reports a single franchise as not spanning", () => {
  const choices = buildOutletChoices(
    [outletMapping("1", "10442", "22318"), outletMapping("2", "10442", "22319")],
    {}
  )

  assert.equal(spansMultipleFranchises(choices), false)
})

test("lists franchise-wide franchises once, in first-seen order", () => {
  assert.deepEqual(
    franchiseWideIds([
      outletMapping("1", "10233", "21004"),
      franchiseWideMapping("2", "11007"),
      franchiseWideMapping("3", "11007"),
      franchiseWideMapping("4", "10442"),
    ]),
    ["11007", "10442"]
  )
})

test("labels a choice with the franchise only when asked", () => {
  const [choice] = buildOutletChoices([outletMapping("1", "10442", "22318")], {})

  assert.equal(
    describeOutletChoice(choice, { showFranchise: false }),
    "Outlet 22318 · 22318"
  )
  assert.equal(
    describeOutletChoice(choice, { showFranchise: true }),
    "Outlet 22318 · 22318 — Franchise 10442"
  )
})

test("falls back to ids when names are missing", () => {
  const choice = {
    value: "10442:22318",
    franchiseId: "10442",
    outletId: "22318",
    outletName: null,
    franchiseName: null,
    source: "outlet_mapping" as const,
  }

  assert.equal(
    describeOutletChoice(choice, { showFranchise: true }),
    "Outlet 22318 — FID 10442"
  )
})
