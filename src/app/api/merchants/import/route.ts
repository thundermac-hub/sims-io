import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { isCronSecretAuthorized } from "@/lib/cron-auth"
import { runMerchantImport } from "@/lib/merchant-import"

export async function POST(request: NextRequest) {
  const cronAllowed = isCronSecretAuthorized(request, process.env.MERCHANT_IMPORT_CRON_SECRET)

  if (!cronAllowed) {
    // A full import overwrites the merchant directory, so the manual path
    // requires the /merchants key plus the Admin role.
    const auth = await resolveApiUser(request, {
      allowedPaths: ["/merchants"],
      requireRole: "Admin",
    })
    if ("response" in auth) {
      return auth.response
    }
  }

  try {
    const result = await runMerchantImport(cronAllowed ? "cron" : "manual")
    return NextResponse.json({ result })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Import failed. Check server logs." },
      { status: 500 }
    )
  }
}
