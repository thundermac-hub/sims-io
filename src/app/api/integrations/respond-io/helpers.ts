import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"

export const INTEGRATIONS_ACCESS_PATH = "/integrations"

export type IntegrationsAuthUser = {
  id: string
  name: string
  email: string
  role: string
}

/**
 * Gate for the Integrations settings routes.
 *
 * Viewing the settings and the event log needs the `/integrations` key. Issuing or
 * revoking a shared secret additionally needs Admin or Super Admin — the same inline
 * role comparison the rest of the app uses — because a rotated secret silently breaks
 * every n8n workflow until someone updates them.
 */
export async function resolveIntegrationsUser(
  request: NextRequest,
  requireAdmin: boolean
): Promise<{ user: IntegrationsAuthUser } | { response: NextResponse }> {
  return resolveApiUser(request, {
    allowedPaths: [INTEGRATIONS_ACCESS_PATH],
    ...(requireAdmin
      ? {
          requireRole: "Admin",
          roleErrorMessage: "Only an Admin can change integration secrets.",
        }
      : {}),
  })
}

export function canManageSecrets(role: string): boolean {
  return role === "Admin" || role === "Super Admin"
}
