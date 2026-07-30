import { toPlainCommentText } from "./project-comments.ts"

type SendMailInput = {
  to: string | string[]
  subject: string
  html: string
  text: string
}

export type ProjectNotificationType =
  | "statusChanged"
  | "activityCreated"
  | "commentPosted"
  | "ownershipTransferred"

/**
 * Everything a notification email needs. Kept flat and primitive so the builder
 * stays pure and the callers do all the DB work.
 */
export type ProjectNotificationEvent = {
  type: ProjectNotificationType
  projectName: string
  /** Human path to the affected item, e.g. "Discovery › User interviews". */
  itemPath: string | null
  itemType?: "Phase" | "Activity" | null
  actorName: string
  previousStatus?: string | null
  newStatus?: string | null
  /** Raw comment body (mention markers are flattened by the builder). */
  commentBody?: string | null
  /** Ownership transfer only. */
  previousOwnerName?: string | null
  newOwnerName?: string | null
  deepLink: string
}

export type ProjectNotificationRecipient = {
  userId: string
  name: string | null
  email: string | null
}

export type ResolveRecipientsInput = {
  /** Every member of the project (Owner, Editors, Viewers). */
  members: readonly ProjectNotificationRecipient[]
  /** The affected item's assignee, if any. */
  assigneeUserId?: string | null
  /** Users @mentioned in a comment. */
  mentionedUserIds?: readonly string[]
  /** The person who caused the event — never notified about their own action. */
  actorUserId: string
}

/**
 * Resolves the recipient list for one event.
 *
 * The PRD asks for the assignee, the mentioned users, and every member with
 * project visibility. All three are honoured, but the result is a single deduped
 * address list rather than one message per person: `sendMail` accepts an array, so
 * one event is one SMTP send instead of N through a synchronous transport with no
 * queue.
 *
 * The actor is always removed — nobody needs an email about what they just did.
 * Assignee and mentioned ids that are not project members are ignored: they cannot
 * see the project, so they must not receive its contents.
 */
export function resolveProjectRecipients(
  input: ResolveRecipientsInput
): string[] {
  const byUserId = new Map(
    input.members.map((member) => [String(member.userId), member])
  )

  const targetIds = new Set<string>()
  for (const member of input.members) {
    targetIds.add(String(member.userId))
  }
  // Assignee and mentions are already members in practice; adding them here keeps
  // the contract explicit rather than relying on that.
  if (input.assigneeUserId) {
    targetIds.add(String(input.assigneeUserId))
  }
  for (const mentioned of input.mentionedUserIds ?? []) {
    targetIds.add(String(mentioned))
  }

  targetIds.delete(String(input.actorUserId))

  const emails = new Set<string>()
  for (const userId of targetIds) {
    const email = byUserId.get(userId)?.email?.trim().toLowerCase()
    if (email) {
      emails.add(email)
    }
  }
  return [...emails]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function eventTitle(event: ProjectNotificationEvent): string {
  switch (event.type) {
    case "statusChanged":
      return "Status Updated"
    case "activityCreated":
      return "New Activity"
    case "commentPosted":
      return "New Comment"
    case "ownershipTransferred":
      return "Ownership Transferred"
  }
}

function eventSummary(event: ProjectNotificationEvent): string {
  const item = event.itemPath ?? event.projectName
  switch (event.type) {
    case "statusChanged":
      return `${event.actorName} changed "${item}" from ${
        event.previousStatus ?? "—"
      } to ${event.newStatus ?? "—"}.`
    case "activityCreated":
      return `${event.actorName} added the activity "${item}".`
    case "commentPosted":
      return `${event.actorName} commented on "${item}".`
    case "ownershipTransferred":
      return `${event.actorName} transferred ownership of "${event.projectName}" from ${
        event.previousOwnerName ?? "—"
      } to ${event.newOwnerName ?? "—"}.`
  }
}

/**
 * Builds the email for any project event.
 *
 * One shell and one `escapeHtml` for all four event types. Every other notifier in
 * this repo duplicates its own template, which is the right call at one event each
 * — at four it is not, so this deliberately deviates and switches on the type
 * inside a single builder. Visual conventions still match the rest of the app
 * (#f3f4f6 background, #111827 header, #0f766e accent).
 */
export function buildProjectNotificationEmail(
  event: ProjectNotificationEvent
): { subject: string; text: string; html: string } {
  const title = eventTitle(event)
  const summary = eventSummary(event)

  const fields: Array<[string, string]> = [
    ["Project", event.projectName],
    ["Action", title],
    ["By", event.actorName],
  ]
  if (event.itemPath) {
    fields.splice(1, 0, [event.itemType === "Activity" ? "Activity" : "Phase", event.itemPath])
  }
  if (event.type === "statusChanged") {
    fields.push([
      "Status",
      `${event.previousStatus ?? "—"} → ${event.newStatus ?? "—"}`,
    ])
  }
  if (event.type === "ownershipTransferred") {
    fields.push(["Previous owner", event.previousOwnerName ?? "—"])
    fields.push(["New owner", event.newOwnerName ?? "—"])
  }

  // Mention markers are flattened so an email never shows `@[Name](42)`.
  const comment = event.commentBody
    ? toPlainCommentText(event.commentBody)
    : null

  const subject = `[${event.projectName}] ${title}${
    event.itemPath ? ` - ${event.itemPath}` : ""
  }`

  const text = [
    summary,
    "",
    ...fields.map(([label, value]) => `${label}: ${value}`),
    ...(comment ? ["", "Comment:", comment] : []),
    "",
    `Open in SIMS: ${event.deepLink}`,
  ].join("\n")

  const rows = fields
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;width:160px;font-weight:600;color:#111827;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:pre-line;">${escapeHtml(value)}</td>
        </tr>
      `
    )
    .join("")

  const commentBlock = comment
    ? `
            <div style="margin-top:20px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;color:#374151;white-space:pre-line;">${escapeHtml(comment)}</div>
      `
    : ""

  return {
    subject,
    text,
    html: `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="padding:20px 24px;background:#111827;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">${escapeHtml(title)}</div>
            <div style="margin-top:8px;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(event.projectName)}</div>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(summary)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              ${rows}
            </table>
            ${commentBlock}
            <div style="margin-top:24px;">
              <a href="${escapeHtml(event.deepLink)}" style="display:inline-block;padding:11px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;">Open in SIMS</a>
            </div>
          </div>
          <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
            Sent by SIMS Project Tracker
          </div>
        </div>
      </div>
    `,
  }
}

export type SendProjectNotificationInput = {
  event: ProjectNotificationEvent
  recipients: string[]
  /** Injectable for tests; defaults to the real SMTP sender. */
  sendMail?: (input: SendMailInput) => Promise<void>
}

export type SendProjectNotificationResult =
  | { sent: true }
  | { sent: false; reason: "no-recipients" | "send-failed" }

/**
 * Sends exactly one message per event to the deduped recipient list.
 *
 * Best-effort by design, matching every other notifier here: a failure is logged
 * and reported, never thrown, so a flaky SMTP hop cannot fail the user's request.
 */
export async function sendProjectNotification(
  input: SendProjectNotificationInput
): Promise<SendProjectNotificationResult> {
  if (input.recipients.length === 0) {
    return { sent: false, reason: "no-recipients" }
  }

  const sendMail =
    input.sendMail ??
    (async (mailInput: SendMailInput) => {
      const mail = await import("@/lib/mail")
      await mail.sendMail(mailInput)
    })

  const email = buildProjectNotificationEmail(input.event)
  try {
    await sendMail({
      to: input.recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })
    return { sent: true }
  } catch (error) {
    console.error("Failed to send project notification", error)
    return { sent: false, reason: "send-failed" }
  }
}
