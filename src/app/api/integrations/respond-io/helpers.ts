import { NextRequest, NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth"
import { hasPageAccessForPath } from "@/lib/page-access"

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
  const user = await requireAuthenticatedUser(request)
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    }
  }

  const isSuperAdmin = user.role === "Super Admin"
  const isAdmin = isSuperAdmin || user.role === "Admin"

  if (
    !isSuperAdmin &&
    !hasPageAccessForPath(INTEGRATIONS_ACCESS_PATH, user.pageAccess)
  ) {
    return { response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  }

  if (requireAdmin && !isAdmin) {
    return {
      response: NextResponse.json(
        { error: "Only an Admin can change integration secrets." },
        { status: 403 }
      ),
    }
  }

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }
}

export function canManageSecrets(role: string): boolean {
  return role === "Admin" || role === "Super Admin"
}
