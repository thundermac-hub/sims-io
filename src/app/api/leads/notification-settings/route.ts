import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import getPool from "@/lib/db"
import {
  DEFAULT_LEAD_NOTIFICATION_SENDER,
  LEAD_NOTIFICATION_SETTINGS_ID,
  getLeadNotificationSettings,
  isValidEmail,
  parseLeadNotificationRecipients,
  serializeLeadNotificationRecipients,
} from "@/lib/lead-notification"
import { parseJsonBody } from "@/lib/validation"

import { notificationSettingsSchema } from "./schema"

export async function GET(request: NextRequest) {
  const auth = await resolveApiUser(request, {})
  if ("response" in auth) {
    return auth.response
  }

  const settings = await getLeadNotificationSettings()
  return NextResponse.json({
    settings: {
      ...settings,
      recipientsText: settings.recipients.join("\n"),
    },
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await resolveApiUser(request, { requireRole: "Admin" })
  if ("response" in auth) {
    return auth.response
  }
  const user = auth.user

  const parsedBody = await parseJsonBody(request, notificationSettingsSchema)
  if (!parsedBody.ok) {
    return parsedBody.response
  }
  const body = parsedBody.data

  if (typeof body.isEnabled !== "boolean") {
    return NextResponse.json({ error: "Invalid notification status." }, { status: 400 })
  }

  const recipients = parseLeadNotificationRecipients(body.recipients ?? "")
  if (recipients.some((email) => !isValidEmail(email))) {
    return NextResponse.json({ error: "One or more recipient emails are invalid." }, { status: 400 })
  }

  try {
    const pool = getPool()
    await pool.query(
      `
        INSERT INTO lead_notification_settings (
          id,
          is_enabled,
          sender_email,
          recipients,
          updated_by
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          is_enabled = VALUES(is_enabled),
          recipients = VALUES(recipients),
          updated_by = VALUES(updated_by),
          updated_at = CURRENT_TIMESTAMP(3)
      `,
      [
        LEAD_NOTIFICATION_SETTINGS_ID,
        body.isEnabled,
        DEFAULT_LEAD_NOTIFICATION_SENDER,
        serializeLeadNotificationRecipients(recipients) || null,
        user.id,
      ]
    )

    const settings = await getLeadNotificationSettings()
    return NextResponse.json({
      settings: {
        ...settings,
        recipientsText: settings.recipients.join("\n"),
      },
    })
  } catch (error) {
    console.error("Failed to save lead notification settings:", error)
    return NextResponse.json(
      { error: "Failed to save notification settings. Please try again." },
      { status: 500 }
    )
  }
}
