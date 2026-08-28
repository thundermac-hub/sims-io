import assert from "node:assert/strict"
import test from "node:test"

import { MAX_OBJECT_KEY_LENGTH, parseObjectKey } from "./storage-keys.ts"

test("accepts keys produced by buildObjectKey", () => {
  const parsed = parseObjectKey("uploads/42/1756270000000-123456789.xlsx")
  assert.deepEqual(parsed, {
    key: "uploads/42/1756270000000-123456789.xlsx",
    prefix: "uploads",
    owner: "42",
    stem: "1756270000000-123456789",
    extension: "xlsx",
  })
})

test("accepts public support-form keys and extension-less stems", () => {
  assert.equal(
    parseObjectKey("support-form/public/1756270000000-1.png")?.owner,
    "public"
  )
  const noExt = parseObjectKey("avatars/7/1756270000000-99")
  assert.equal(noExt?.extension, "")
  assert.equal(noExt?.stem, "1756270000000-99")
})

test("rejects traversal, separators, and segment-count attacks", () => {
  assert.equal(parseObjectKey("uploads/42/../../etc/passwd"), null)
  assert.equal(parseObjectKey("x.evil/../../foo"), null)
  assert.equal(parseObjectKey("uploads//1756270000000-1.png"), null)
  assert.equal(parseObjectKey("uploads\\42\\1756270000000-1.png"), null)
  assert.equal(parseObjectKey("uploads/42/extra/1756270000000-1.png"), null)
  assert.equal(parseObjectKey("uploads/42"), null)
})

test("rejects unknown prefixes and malformed owners", () => {
  assert.equal(parseObjectKey("secrets/42/1756270000000-1.png"), null)
  assert.equal(parseObjectKey("uploads/alice/1756270000000-1.png"), null)
  assert.equal(parseObjectKey("uploads/-1/1756270000000-1.png"), null)
})

test("rejects malformed stems and extensions", () => {
  assert.equal(parseObjectKey("uploads/42/notastem.png"), null)
  assert.equal(parseObjectKey("uploads/42/1756270000000-1.PNG"), null)
  assert.equal(parseObjectKey("uploads/42/1756270000000-1.p ng"), null)
  assert.equal(parseObjectKey("uploads/42/1756270000000-1.verylongext"), null)
})

test("rejects non-strings, empties, and oversized keys", () => {
  assert.equal(parseObjectKey(null), null)
  assert.equal(parseObjectKey(42), null)
  assert.equal(parseObjectKey(""), null)
  assert.equal(parseObjectKey("   "), null)
  const long = `uploads/42/${"1".repeat(MAX_OBJECT_KEY_LENGTH)}-1.png`
  assert.equal(parseObjectKey(long), null)
})
