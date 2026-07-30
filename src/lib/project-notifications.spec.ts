import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProjectNotificationEmail,
  resolveProjectRecipients,
  sendProjectNotification,
} from "./project-notifications.ts"
import type {
  ProjectNotificationEvent,
  ProjectNotificationRecipient,
} from "./project-notifications.ts"

function member(
  userId: string,
  email: string | null,
  name = `User ${userId}`
): ProjectNotificationRecipient {
  return { userId, name, email }
}

const baseEvent: ProjectNotificationEvent = {
  type: "statusChanged",
  projectName: "Onboarding revamp",
  itemPath: "Discovery › User interviews",
  itemType: "Activity",
  actorName: "Hafiz",
  previousStatus: "In Progress",
  newStatus: "Completed",
  deepLink: "https://sims.example.com/projects/7",
}

test("resolveProjectRecipients includes every member except the actor", () => {
  const recipients = resolveProjectRecipients({
    members: [
      member("1", "owner@example.com"),
      member("2", "editor@example.com"),
      member("3", "viewer@example.com"),
    ],
    actorUserId: "2",
  })
  assert.deepEqual(recipients.sort(), [
    "owner@example.com",
    "viewer@example.com",
  ])
})

test("resolveProjectRecipients dedupes by lowercased email", () => {
  // The assignee and a mentioned user are also members; each must appear once.
  const recipients = resolveProjectRecipients({
    members: [
      member("1", "Owner@Example.com"),
      member("2", "owner@example.com"),
      member("3", "viewer@example.com"),
    ],
    assigneeUserId: "1",
    mentionedUserIds: ["1", "3"],
    actorUserId: "9",
  })
  assert.deepEqual(recipients.sort(), ["owner@example.com", "viewer@example.com"])
})

test("resolveProjectRecipients drops the actor even when mentioned or assigned", () => {
  const recipients = resolveProjectRecipients({
    members: [member("1", "me@example.com"), member("2", "other@example.com")],
    assigneeUserId: "1",
    mentionedUserIds: ["1"],
    actorUserId: "1",
  })
  assert.deepEqual(recipients, ["other@example.com"])
})

test("resolveProjectRecipients ignores non-members and members with no email", () => {
  // A mentioned id that is not a member has no project access, so it must not
  // receive project contents.
  const recipients = resolveProjectRecipients({
    members: [member("1", "in@example.com"), member("2", null)],
    mentionedUserIds: ["99"],
    actorUserId: "5",
  })
  assert.deepEqual(recipients, ["in@example.com"])
})

test("resolveProjectRecipients returns empty when the actor is the only member", () => {
  const recipients = resolveProjectRecipients({
    members: [member("1", "solo@example.com")],
    actorUserId: "1",
  })
  assert.deepEqual(recipients, [])
})

test("buildProjectNotificationEmail includes project, item, action, and link", () => {
  const email = buildProjectNotificationEmail(baseEvent)

  assert.match(email.subject, /Onboarding revamp/)
  assert.match(email.subject, /Status Updated/)
  assert.match(email.subject, /User interviews/)

  for (const body of [email.text, email.html]) {
    assert.match(body, /Onboarding revamp/)
    assert.match(body, /User interviews/)
    assert.match(body, /In Progress/)
    assert.match(body, /Completed/)
    assert.match(body, /Hafiz/)
    assert.match(body, /https:\/\/sims\.example\.com\/projects\/7/)
  }
})

test("buildProjectNotificationEmail describes activity creation", () => {
  const email = buildProjectNotificationEmail({
    ...baseEvent,
    type: "activityCreated",
    previousStatus: null,
    newStatus: "Not Started",
  })
  assert.match(email.subject, /New Activity/)
  assert.match(email.text, /added the activity/)
})

test("buildProjectNotificationEmail describes ownership transfer for both parties", () => {
  const email = buildProjectNotificationEmail({
    ...baseEvent,
    type: "ownershipTransferred",
    itemPath: null,
    previousOwnerName: "Hafiz",
    newOwnerName: "Alice Tan",
  })
  assert.match(email.subject, /Ownership Transferred/)
  assert.match(email.text, /Previous owner: Hafiz/)
  assert.match(email.text, /New owner: Alice Tan/)
})

test("buildProjectNotificationEmail flattens mention markers in a comment", () => {
  const email = buildProjectNotificationEmail({
    ...baseEvent,
    type: "commentPosted",
    commentBody: "Nice work @[Alice Tan](42)",
  })
  assert.match(email.text, /Nice work @Alice Tan/)
  assert.match(email.html, /Nice work @Alice Tan/)
  // The raw marker never reaches the reader.
  assert.doesNotMatch(email.text, /\(42\)/)
})

test("buildProjectNotificationEmail escapes HTML in untrusted fields", () => {
  const email = buildProjectNotificationEmail({
    ...baseEvent,
    type: "commentPosted",
    projectName: "<script>alert(1)</script>",
    commentBody: "<img src=x onerror=alert(1)>",
  })
  assert.doesNotMatch(email.html, /<script>/)
  assert.doesNotMatch(email.html, /<img /)
  assert.match(email.html, /&lt;script&gt;/)
})

test("buildProjectNotificationEmail omits the item row when there is no item", () => {
  const email = buildProjectNotificationEmail({
    ...baseEvent,
    type: "ownershipTransferred",
    itemPath: null,
  })
  assert.doesNotMatch(email.subject, / - /)
})

test("sendProjectNotification sends exactly one message to all recipients", async () => {
  const sends: Array<{ to: string | string[]; subject: string }> = []
  const result = await sendProjectNotification({
    event: baseEvent,
    recipients: ["a@example.com", "b@example.com", "c@example.com"],
    sendMail: async (input) => {
      sends.push({ to: input.to, subject: input.subject })
    },
  })

  assert.deepEqual(result, { sent: true })
  // One SMTP send for the whole project, not one per recipient.
  assert.equal(sends.length, 1)
  assert.deepEqual(sends[0].to, [
    "a@example.com",
    "b@example.com",
    "c@example.com",
  ])
})

test("sendProjectNotification skips sending when there are no recipients", async () => {
  let called = false
  const result = await sendProjectNotification({
    event: baseEvent,
    recipients: [],
    sendMail: async () => {
      called = true
    },
  })
  assert.deepEqual(result, { sent: false, reason: "no-recipients" })
  assert.equal(called, false)
})

test("sendProjectNotification reports a send failure instead of throwing", async () => {
  const result = await sendProjectNotification({
    event: baseEvent,
    recipients: ["a@example.com"],
    sendMail: async () => {
      throw new Error("SMTP down")
    },
  })
  assert.deepEqual(result, { sent: false, reason: "send-failed" })
})
