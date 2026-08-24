/**
 * Turn a contact's outlet mappings into the list of outlets a ticket may be linked to.
 *
 * The Respond.io flow auto-links a ticket only when the contact resolves to exactly one
 * outlet (`resolveOutletMatch` in `src/lib/respondio-resolution.ts`). Every other mapped
 * contact -- several outlets under one franchise, a franchise-wide mapping, or mappings
 * spanning franchises -- used to leave the agent typing an fid/oid pair by hand even
 * though SIMS already knows the exact set of outlets that contact represents. These
 * helpers produce that set so the panel can offer a dropdown instead.
 *
 * Two mapping shapes feed the list:
 *   - outlet-specific rows contribute themselves;
 *   - a franchise-wide row contributes every outlet under its franchise, which the
 *     caller loads from `/api/merchants/{fid}/outlets` and passes in here.
 *
 * Nothing in this file touches the network or the database, so the expansion and
 * de-duplication rules stay unit-testable.
 */

import type { ContactMapping } from "@/lib/contact-mappings"

export type FranchiseOutlet = {
  externalId: string
  name: string | null
}

export type OutletChoice = {
  /** Stable `fid:oid` key for the select's value. */
  value: string
  franchiseId: string
  outletId: string
  outletName: string | null
  franchiseName: string | null
  /** How the outlet became eligible: mapped directly, or via a franchise-wide row. */
  source: "outlet_mapping" | "franchise_wide"
}

export function buildChoiceValue(franchiseId: string, outletId: string): string {
  return `${franchiseId}:${outletId}`
}

/** Franchise ids the contact is mapped to franchise-wide, in first-seen order. */
export function franchiseWideIds(mappings: ContactMapping[]): string[] {
  const ids: string[] = []
  for (const mapping of mappings) {
    if (mapping.outletId === null && !ids.includes(mapping.franchiseId)) {
      ids.push(mapping.franchiseId)
    }
  }
  return ids
}

/**
 * Build the selectable outlets for a contact.
 *
 * `franchiseOutlets` maps a franchise id to the outlets under it; a franchise-wide
 * mapping whose franchise is absent (still loading, or the fetch failed) simply
 * contributes nothing rather than blocking the outlet-specific rows.
 *
 * Order follows the mappings, so the agent sees the contact's own list in the order the
 * contact page shows it. Duplicates -- the same outlet reachable through both a
 * franchise-wide row and an outlet-specific row -- collapse to the first occurrence.
 */
export function buildOutletChoices(
  mappings: ContactMapping[],
  franchiseOutlets: Record<string, FranchiseOutlet[]>
): OutletChoice[] {
  const choices: OutletChoice[] = []
  const seen = new Set<string>()

  const franchiseNames = new Map<string, string | null>()
  for (const mapping of mappings) {
    if (mapping.franchiseName && !franchiseNames.get(mapping.franchiseId)) {
      franchiseNames.set(mapping.franchiseId, mapping.franchiseName)
    }
  }

  const push = (choice: OutletChoice) => {
    if (seen.has(choice.value)) {
      return
    }
    seen.add(choice.value)
    choices.push(choice)
  }

  for (const mapping of mappings) {
    const franchiseName = franchiseNames.get(mapping.franchiseId) ?? null

    if (mapping.outletId !== null) {
      push({
        value: buildChoiceValue(mapping.franchiseId, mapping.outletId),
        franchiseId: mapping.franchiseId,
        outletId: mapping.outletId,
        outletName: mapping.outletName ?? null,
        franchiseName,
        source: "outlet_mapping",
      })
      continue
    }

    for (const outlet of franchiseOutlets[mapping.franchiseId] ?? []) {
      push({
        value: buildChoiceValue(mapping.franchiseId, outlet.externalId),
        franchiseId: mapping.franchiseId,
        outletId: outlet.externalId,
        outletName: outlet.name ?? null,
        franchiseName,
        source: "franchise_wide",
      })
    }
  }

  return choices
}

/** Dropdown label: outlet name plus its oid, and the franchise when more than one is in play. */
export function describeOutletChoice(
  choice: OutletChoice,
  options: { showFranchise: boolean }
): string {
  const outlet = choice.outletName
    ? `${choice.outletName} · ${choice.outletId}`
    : `Outlet ${choice.outletId}`

  if (!options.showFranchise) {
    return outlet
  }

  return `${outlet} — ${choice.franchiseName ?? `FID ${choice.franchiseId}`}`
}

/** True when the choices span more than one franchise, so labels must name it. */
export function spansMultipleFranchises(choices: OutletChoice[]): boolean {
  return new Set(choices.map((choice) => choice.franchiseId)).size > 1
}
