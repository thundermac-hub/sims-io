import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { getGooglePlaceDetails } from "@/lib/google-places"

export async function POST(request: NextRequest) {
  // Every UI that renders the location picker: sales appointments, lead
  // activities, merchant/contact forms, and onboarding scheduling.
  const auth = await resolveApiUser(request, {
    allowedPaths: [
      "/sales/appointments",
      "/sales/leads",
      "/merchants",
      "/contacts",
      "/merchant-success/onboarding-appointments",
    ],
  })
  if ("response" in auth) {
    return auth.response
  }

  const body = (await request.json()) as {
    placeId?: unknown
    sessionToken?: unknown
  }

  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : ""
  const sessionToken =
    typeof body.sessionToken === "string" ? body.sessionToken.trim() : ""

  if (!placeId || !sessionToken) {
    return NextResponse.json(
      { error: "Place id and session token are required." },
      { status: 400 }
    )
  }

  try {
    const result = await getGooglePlaceDetails({ placeId, sessionToken })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[google-places]", error)
    return NextResponse.json(
      { error: "Unable to load Google Place details." },
      { status: 502 }
    )
  }
}
