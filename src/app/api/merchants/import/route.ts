import { timingSafeEqual } from "crypto"

import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { runMerchantImport } from "@/lib/merchant-import"

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.MERCHANT_IMPORT_CRON_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim()
  if (!cronSecret || !providedSecret) {
    return false
  }
  const expected = Buffer.from(cronSecret)
  const provided = Buffer.from(providedSecret)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function POST(request: NextRequest) {
  const cronAllowed = isCronAuthorized(request)

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
