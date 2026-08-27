import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import {
  getGooglePlacesConfig,
  searchGooglePlacesAutocomplete,
} from "@/lib/google-places"

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
    input?: unknown
    sessionToken?: unknown
  }

  const input = typeof body.input === "string" ? body.input.trim() : ""
  const sessionToken =
    typeof body.sessionToken === "string" ? body.sessionToken.trim() : ""

  if (!input || !sessionToken) {
    return NextResponse.json({
      enabled: getGooglePlacesConfig().enabled,
      predictions: [],
    })
  }

  try {
    const result = await searchGooglePlacesAutocomplete({ input, sessionToken })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to search Google Places.",
      },
      { status: 502 }
    )
  }
}
