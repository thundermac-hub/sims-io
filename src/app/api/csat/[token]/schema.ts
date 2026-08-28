import { z } from "zod"

import { CSAT_SCORE_LABELS } from "@/lib/csat-google-review"

const MAX_FEEDBACK_LENGTH = 2000

/** Optional free text: trimmed, empty → null, capped at 2000 chars. */
const optionalFeedback = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (typeof value !== "string") {
      return null
    }
    const trimmed = value.trim()
    if (trimmed.length > MAX_FEEDBACK_LENGTH) {
      ctx.addIssue({ code: "custom", message: "Feedback is too long." })
      return z.NEVER
    }
    return trimmed ? trimmed : null
  })

export const csatSubmissionSchema = z.object({
  supportScore: z.enum(CSAT_SCORE_LABELS),
  supportReason: optionalFeedback,
  productScore: z.enum(CSAT_SCORE_LABELS),
  productFeedback: optionalFeedback,
})
