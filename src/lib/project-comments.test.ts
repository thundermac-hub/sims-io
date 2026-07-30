import assert from "node:assert/strict"
import test from "node:test"

import {
  parseMentions,
  splitCommentSegments,
  toPlainCommentText,
  validateCommentInput,
} from "./project-comments.ts"

test("parseMentions keeps markers for project members", () => {
  const result = parseMentions("Ping @[Alice Tan](42) please", ["42", "43"])
  assert.deepEqual(result, {
    body: "Ping @[Alice Tan](42) please",
    mentionedUserIds: ["42"],
    droppedNames: [],
  })
})

test("parseMentions downgrades non-members to plain text", () => {
  // Silently notifying someone without project access would leak project
  // content, so the marker is flattened rather than the comment rejected.
  const result = parseMentions("cc @[Outsider](99)", ["42"])
  assert.deepEqual(result, {
    body: "cc @Outsider",
    mentionedUserIds: [],
    droppedNames: ["Outsider"],
  })
})

test("parseMentions handles a mix of members and non-members", () => {
  const result = parseMentions(
    "@[Alice Tan](42) and @[Ghost](99) and @[Bob](43)",
    ["42", "43"]
  )
  assert.equal(result.body, "@[Alice Tan](42) and @Ghost and @[Bob](43)")
  assert.deepEqual(result.mentionedUserIds, ["42", "43"])
  assert.deepEqual(result.droppedNames, ["Ghost"])
})

test("parseMentions dedupes a user mentioned twice", () => {
  const result = parseMentions("@[Alice](42) @[Alice](42)", ["42"])
  assert.deepEqual(result.mentionedUserIds, ["42"])
})

test("parseMentions returns nothing for a body with no markers", () => {
  const result = parseMentions("just a plain comment", ["42"])
  assert.deepEqual(result, {
    body: "just a plain comment",
    mentionedUserIds: [],
    droppedNames: [],
  })
})

test("parseMentions ignores a bare @name that is not a marker", () => {
  const result = parseMentions("email me @alice or @[Alice](42)", ["42"])
  assert.deepEqual(result.mentionedUserIds, ["42"])
  assert.equal(result.body, "email me @alice or @[Alice](42)")
})

test("parseMentions accepts numeric member ids passed as numbers", () => {
  // Member ids arrive from MySQL as strings, but be tolerant of numbers.
  const result = parseMentions("@[Alice](42)", [42 as unknown as string])
  assert.deepEqual(result.mentionedUserIds, ["42"])
})

test("splitCommentSegments separates text and mentions in order", () => {
  assert.deepEqual(
    splitCommentSegments("Hi @[Alice Tan](42), see this."),
    [
      { kind: "text", text: "Hi " },
      { kind: "mention", displayName: "Alice Tan", userId: "42" },
      { kind: "text", text: ", see this." },
    ]
  )
})

test("splitCommentSegments handles a body that is only a mention", () => {
  assert.deepEqual(splitCommentSegments("@[Alice](42)"), [
    { kind: "mention", displayName: "Alice", userId: "42" },
  ])
})

test("splitCommentSegments handles back-to-back mentions", () => {
  assert.deepEqual(splitCommentSegments("@[A](1)@[B](2)"), [
    { kind: "mention", displayName: "A", userId: "1" },
    { kind: "mention", displayName: "B", userId: "2" },
  ])
})

test("splitCommentSegments is repeatable across calls", () => {
  // Guards against a shared global regex lastIndex leaking between calls.
  const body = "@[A](1) then @[B](2)"
  assert.deepEqual(splitCommentSegments(body), splitCommentSegments(body))
})

test("splitCommentSegments returns an empty list for an empty body", () => {
  assert.deepEqual(splitCommentSegments(""), [])
})

test("toPlainCommentText flattens markers for emails", () => {
  assert.equal(
    toPlainCommentText("Hi @[Alice Tan](42) and @[Bob](43)"),
    "Hi @Alice Tan and @Bob"
  )
})

test("validateCommentInput trims and accepts a normal comment", () => {
  assert.deepEqual(validateCommentInput({ body: "  looks good  " }), {
    ok: true,
    value: { body: "looks good" },
  })
})

test("validateCommentInput rejects empty, whitespace, and oversized bodies", () => {
  assert.equal(validateCommentInput({ body: "" }).ok, false)
  assert.equal(validateCommentInput({ body: "   " }).ok, false)
  assert.equal(validateCommentInput({ body: "a".repeat(4001) }).ok, false)
  assert.equal(validateCommentInput({ body: "a".repeat(4000) }).ok, true)
})

test("validateCommentInput rejects a non-object or non-string body", () => {
  assert.equal(validateCommentInput(null).ok, false)
  assert.equal(validateCommentInput({ body: 42 }).ok, false)
})
