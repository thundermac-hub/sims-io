import assert from "node:assert/strict"
import test from "node:test"

import { pickMerchantNames } from "./merchant-outlet-resolution.ts"

test("prefers the franchise-keyed row for both names", () => {
  assert.deepEqual(
    pickMerchantNames(
      { franchiseName: "Teh Tarik House", outletName: "Mid Valley" },
      { franchiseName: "Wrong Franchise", outletName: "Wrong Outlet" }
    ),
    { franchiseName: "Teh Tarik House", outletName: "Mid Valley" }
  )
})

test("fills a missing outlet name from the outlet-keyed fallback", () => {
  // The franchise query LEFT JOINs the outlet, so it yields a null outlet name when
  // the outlet belongs to a different merchant. Reporting "not found" there would be
  // wrong — the outlet exists, it is just linked elsewhere.
  assert.deepEqual(
    pickMerchantNames(
      { franchiseName: "Teh Tarik House", outletName: null },
      { franchiseName: "Kopitiam Sentral", outletName: "Mid Valley" }
    ),
    { franchiseName: "Teh Tarik House", outletName: "Mid Valley" }
  )
})

test("uses the fallback entirely when the franchise lookup found nothing", () => {
  assert.deepEqual(
    pickMerchantNames(null, {
      franchiseName: "Kopitiam Sentral",
      outletName: "Bukit Bintang",
    }),
    { franchiseName: "Kopitiam Sentral", outletName: "Bukit Bintang" }
  )
})

test("keeps the franchise name when there is no fallback (franchise-only lookup)", () => {
  assert.deepEqual(
    pickMerchantNames({ franchiseName: "Teh Tarik House", outletName: null }, null),
    { franchiseName: "Teh Tarik House", outletName: null }
  )
})

test("returns both names null when nothing resolved", () => {
  assert.deepEqual(pickMerchantNames(null, null), {
    franchiseName: null,
    outletName: null,
  })
})
