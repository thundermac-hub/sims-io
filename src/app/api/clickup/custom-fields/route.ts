import { NextRequest, NextResponse } from "next/server"
import { serverError } from "@/lib/api-errors"

import { requireAuthenticatedUser } from "@/lib/auth"
import { fetchClickUpListFields } from "@/lib/clickup"

function getConfiguredFieldIds() {
  return {
    product: process.env.CLICKUP_CUSTOM_FIELD_PRODUCT_ID?.trim() || null,
    departmentRequest:
      process.env.CLICKUP_CUSTOM_FIELD_DEPARTMENT_REQUEST_ID?.trim() || null,
    priorityLevel: process.env.CLICKUP_CUSTOM_FIELD_PRIORITY_LEVEL_ID?.trim() || null,
    severityLevel: process.env.CLICKUP_CUSTOM_FIELD_SEVERITY_LEVEL_ID?.trim() || null,
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const fields = await fetchClickUpListFields()
    const configuredFieldIds = getConfiguredFieldIds()
    const fieldsById = new Map(fields.map((field) => [field.id, field]))

    const mapOptions = (fieldId: string | null) => {
      if (!fieldId) {
        return []
      }
      const field = fieldsById.get(fieldId)
      if (!field) {
        return []
      }
      return field.options.map((option) => ({
        id: option.id,
        name: option.name,
      }))
    }

    return NextResponse.json({
      configuredFieldIds,
      options: {
        product: mapOptions(configuredFieldIds.product),
        departmentRequest: mapOptions(configuredFieldIds.departmentRequest),
        priorityLevel: mapOptions(configuredFieldIds.priorityLevel),
        severityLevel: mapOptions(configuredFieldIds.severityLevel),
      },
    })
  } catch (error) {
    return serverError("clickup/custom-fields", error, "Unable to load ClickUp custom field options.")
  }
}
