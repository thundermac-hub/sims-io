import assert from "node:assert/strict"
import test from "node:test"

import {
  buildContactScopeClause,
  buildContactSearchClause,
  formatContactSource,
  formatExtraPhones,
  validateContactInput,
} from "./contacts.ts"

const validInput = {
  name: "Tan Wei Ling",
  email: "weiling@teh-tarik-house.com",
  role: "Ops Lead",
  phones: ["+60 16-220 7781"],
}

test("accepts a complete submission and normalizes it", () => {
  const { errors, value } = validateContactInput(validInput)

  assert.deepEqual(errors, {})
  assert.equal(value?.name, "Tan Wei Ling")
  assert.equal(value?.email, "weiling@teh-tarik-house.com")
  assert.equal(value?.role, "Ops Lead")
  assert.deepEqual(value?.phones, [
    { phone: "+60 16-220 7781", phoneNormalized: "+60162207781", isPrimary: true },
  ])
})

test("lowercases and trims the email", () => {
  const { value } = validateContactInput({
    ...validInput,
    email: "  WeiLing@Teh-Tarik-House.com  ",
  })

  assert.equal(value?.email, "weiling@teh-tarik-house.com")
})

test("treats a blank role as absent rather than an empty string", () => {
  assert.equal(validateContactInput({ ...validInput, role: "   " }).value?.role, null)
  assert.equal(validateContactInput({ ...validInput, role: null }).value?.role, null)
})

test("requires a name", () => {
  const { errors, value } = validateContactInput({ ...validInput, name: "  " })

  assert.equal(errors.name, "Name is required.")
  assert.equal(value, null)
})

test("requires a valid email", () => {
  assert.equal(validateContactInput({ ...validInput, email: "" }).errors.email, "Email is required.")
  assert.equal(
    validateContactInput({ ...validInput, email: "not-an-email" }).errors.email,
    "Enter a valid email address."
  )
  assert.equal(
    validateContactInput({ ...validInput, email: "missing@domain" }).errors.email,
    "Enter a valid email address."
  )
})

test("requires at least one phone number", () => {
  assert.equal(
    validateContactInput({ ...validInput, phones: [] }).errors.phones,
    "At least one phone number is required."
  )
  assert.equal(
    validateContactInput({ ...validInput, phones: ["", "  "] }).errors.phones,
    "At least one phone number is required."
  )
})

test("rejects a phone number with no digits", () => {
  const { errors } = validateContactInput({ ...validInput, phones: ["n/a"] })

  assert.equal(errors["phones.0"], "Enter a valid phone number.")
})

test("flags the same number listed twice in different formats", () => {
  // contact_phone_numbers has a UNIQUE key on (contact_id, phone_normalized), so
  // this has to fail validation rather than the insert.
  const { errors } = validateContactInput({
    ...validInput,
    phones: ["+60 16-220 7781", "+60162207781"],
  })

  assert.equal(errors["phones.1"], "This number is already listed on this contact.")
})

test("marks only the first phone number as primary", () => {
  const { value } = validateContactInput({
    ...validInput,
    phones: ["+60 12-345 6789", "+60 3-2145 8890"],
  })

  assert.deepEqual(
    value?.phones.map((phone) => phone.isPrimary),
    [true, false]
  )
})

test("ignores blank entries between real phone numbers", () => {
  const { errors, value } = validateContactInput({
    ...validInput,
    phones: ["+60 12-345 6789", "", "+60 3-2145 8890"],
  })

  assert.deepEqual(errors, {})
  assert.equal(value?.phones.length, 2)
})

test("rejects an over-long name", () => {
  const { errors } = validateContactInput({ ...validInput, name: "a".repeat(256) })

  assert.match(errors.name, /255 characters or fewer/)
})

test("the search clause searches name, email, role and both phone columns", () => {
  const { sql, values } = buildContactSearchClause("016 220")

  assert.match(sql, /LOWER\(contacts\.name\) LIKE \?/)
  assert.match(sql, /LOWER\(contacts\.email\) LIKE \?/)
  assert.match(sql, /contact_phone_numbers/)
  // The phone arm gets the query normalized the same way the stored column is, so
  // "016 220" finds "+60 16-220 7781".
  assert.deepEqual(values, ["%016 220%", "%016 220%", "%016 220%", "%016220%", "%016 220%"])
})

test("the search clause lowercases the query", () => {
  const { values } = buildContactSearchClause("  Wei LING  ")

  assert.equal(values[0], "%wei ling%")
})

test("no scope clause when neither franchise nor outlet is given", () => {
  assert.equal(buildContactScopeClause(null, null), null)
  assert.equal(buildContactScopeClause("  ", ""), null)
})

test("an outlet scope also matches franchise-wide mappings", () => {
  // A contact mapped franchise-wide represents every outlet under it, so it must
  // appear when scoping to any one of them.
  const clause = buildContactScopeClause("11007", "24118")

  assert.match(clause?.sql ?? "", /outlet_id = \? OR contact_outlets\.outlet_id IS NULL/)
  assert.deepEqual(clause?.values, ["11007", "24118"])
})

test("a franchise-only scope matches every mapping under it", () => {
  const clause = buildContactScopeClause("11007", null)

  assert.match(clause?.sql ?? "", /franchise_id = \?/)
  assert.doesNotMatch(clause?.sql ?? "", /outlet_id/)
  assert.deepEqual(clause?.values, ["11007"])
})

test("an outlet-only scope matches that outlet exactly", () => {
  const clause = buildContactScopeClause(null, "24118")

  assert.deepEqual(clause?.values, ["24118"])
})

test("formats the extra-phone hint", () => {
  const phone = (id: string) => ({ id, phone: `+6012345678${id}`, isPrimary: id === "1" })

  assert.equal(formatExtraPhones([]), "")
  assert.equal(formatExtraPhones([phone("1")]), "")
  assert.equal(formatExtraPhones([phone("1"), phone("2")]), "+1 more")
  assert.equal(formatExtraPhones([phone("1"), phone("2"), phone("3")]), "+2 more")
})

test("labels the contact source", () => {
  assert.equal(formatContactSource("staff"), "Added by staff")
  assert.equal(formatContactSource("respond_io"), "Created from Respond.io")
})
