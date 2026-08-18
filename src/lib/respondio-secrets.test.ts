import assert from "node:assert/strict"
import test from "node:test"

import {
  SECRET_PREFIX,
  generateSharedSecret,
  maskSecret,
  secretsMatch,
} from "./respondio-secrets.ts"

test("a generated secret carries the prefix and a matching hash", () => {
  const generated = generateSharedSecret()

  assert.ok(generated.raw.startsWith(SECRET_PREFIX))
  assert.match(generated.secretHash, /^[0-9a-f]{64}$/)
  assert.match(generated.keyId, /^[0-9a-f]{12}$/)
  assert.equal(generated.secretLast4, generated.raw.slice(-4))
  assert.equal(secretsMatch(generated.raw, generated.secretHash), true)
})

test("two generated secrets never collide", () => {
  const first = generateSharedSecret()
  const second = generateSharedSecret()

  assert.notEqual(first.raw, second.raw)
  assert.notEqual(first.keyId, second.keyId)
  assert.notEqual(first.secretHash, second.secretHash)
  assert.equal(secretsMatch(first.raw, second.secretHash), false)
})

test("rejects empty, missing, and whitespace-only input", () => {
  const { secretHash } = generateSharedSecret()

  assert.equal(secretsMatch("", secretHash), false)
  assert.equal(secretsMatch(null, secretHash), false)
  assert.equal(secretsMatch(undefined, secretHash), false)
  assert.equal(secretsMatch(" ", secretHash), false)
})

test("rejects a missing or malformed stored hash instead of throwing", () => {
  // A truncated or non-hex hash cannot be a legitimate match, and Buffer.from would
  // otherwise silently produce a short buffer.
  const { raw } = generateSharedSecret()

  assert.equal(secretsMatch(raw, null), false)
  assert.equal(secretsMatch(raw, ""), false)
  assert.equal(secretsMatch(raw, "deadbeef"), false)
  assert.equal(secretsMatch(raw, "z".repeat(64)), false)
})

test("rejects a near-miss secret", () => {
  const { raw, secretHash } = generateSharedSecret()

  assert.equal(secretsMatch(`${raw}x`, secretHash), false)
  assert.equal(secretsMatch(raw.slice(0, -1), secretHash), false)
  assert.equal(secretsMatch(raw.toUpperCase(), secretHash), false)
})

test("accepts an upper-case stored hash", () => {
  const { raw, secretHash } = generateSharedSecret()

  assert.equal(secretsMatch(raw, secretHash.toUpperCase()), true)
})

test("the masked form shows only the prefix and last four characters", () => {
  const masked = maskSecret("sk_n8n_", "4f2a")

  assert.equal(masked, "sk_n8n_••••••••••••4f2a")
  assert.doesNotMatch(masked, /[A-Za-z0-9]{6,}$/)
})
