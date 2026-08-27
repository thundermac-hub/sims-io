import { NextRequest, NextResponse } from "next/server"

import { resolveApiUser } from "@/lib/api-auth"
import { getGooglePlaceDetails } from "@/lib/google-places"
import { parseJsonBody } from "@/lib/validation"

import { LOCATION_PICKER_PATHS, placeDetailsSchema } from "../schema"

export async function POST(request: NextRequest) {
  const auth = await resolveApiUser(request, {
    allowedPaths: LOCATION_PICKER_PATHS,
  })
  if ("response" in auth) {
    return auth.response
  }

  const body = await parseJsonBody(request, placeDetailsSchema)
  if (!body.ok) {
    return body.response
  }

  const placeId =
    typeof body.data.placeId === "string" ? body.data.placeId.trim() : ""
  const sessionToken =
    typeof body.data.sessionToken === "string"
      ? body.data.sessionToken.trim()
      : ""

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
