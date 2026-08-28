import { z } from "zod"

import { DEAL_STAGES } from "@/lib/deals"

/**
 * Shared request-body schema for creating and updating a deal — used by the
 * lead-scoped deal routes and the global deal route, whose bodies are
 * identical. Loose (`unknown`) fields keep the handlers' hand-rolled checks
 * (`cleanString`, `isCloseLostReason`, `reconcileDealFields`, ...) and exact
 * error messages. `dealStage` derives from the `DEAL_STAGES` tuple; it is
 * `nullish` because the handlers treat `null` like an absent stage (default
 * on create, keep the existing stage on update).
 */
export const dealBodySchema = z.object({
  dealName: z.unknown().optional(),
  dealStage: z.enum(DEAL_STAGES).nullish(),
  amount: z.unknown().optional(),
  closedDate: z.unknown().optional(),
  closeLostReason: z.unknown().optional(),
  closeLostRemarks: z.unknown().optional(),
})
