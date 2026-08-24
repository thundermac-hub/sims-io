"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ContactPicker } from "@/components/contact-picker"
import { useToast } from "@/components/toast-provider"
import {
  buildChoiceValue,
  buildOutletChoices,
  describeOutletChoice,
  franchiseWideIds,
  spansMultipleFranchises,
} from "@/lib/ticket-outlet-choices"
import type { FranchiseOutlet } from "@/lib/ticket-outlet-choices"
import { cn } from "@/lib/utils"

type ResolvedContact = {
  id: string
  name: string
  role: string | null
  phones: { phone: string; isPrimary: boolean }[]
  email: string
  mappings: {
    id: string
    franchiseId: string
    outletId: string | null
    franchiseName: string | null
    outletName: string | null
  }[]
}

/**
 * Outlet linking for a ticket flagged `needs_outlet_match` (Respond.io PRD 4.5).
 *
 * A contact that resolves to exactly one outlet is auto-linked upstream, so every
 * ticket reaching this panel is ambiguous in one of three ways: several outlets mapped
 * under one franchise, a franchise-wide mapping, or mappings spanning franchises. In
 * all three SIMS already knows the finite set of outlets the contact represents, so the
 * agent picks from that set rather than typing an fid/oid pair — outlet-specific
 * mappings offer themselves, and a franchise-wide mapping offers every outlet under its
 * franchise. Picking fills both ids at once, which is also what keeps a multi-franchise
 * contact from being linked to the wrong franchise.
 *
 * Manual entry remains, as the fallback for a contact with no usable mappings and as an
 * escape hatch when the right outlet is not mapped yet. When the ticket's franchise was
 * pre-filled from a franchise-wide mapping, `fid` is read-only there so only the outlet
 * id is needed (AC12), and the choice list is narrowed to that franchise.
 *
 * Saving goes through the ticket's existing PATCH, which also clears
 * `needs_outlet_match` and writes the confirmed mapping back to `contact_outlets` —
 * unless a franchise-wide mapping already covers it (AC13).
 */
export function OutletLinkPanel({
  ticketId,
  fid,
  oid,
  contactId,
  needsOutletMatch,
  onLinked,
}: {
  ticketId: string
  fid: string | null
  oid: string | null
  contactId: string | null
  needsOutletMatch: boolean
  onLinked: () => void
}) {
  const { showToast } = useToast()

  const [franchiseInput, setFranchiseInput] = React.useState(fid ?? "")
  const [outletInput, setOutletInput] = React.useState(oid ?? "")
  const [resolved, setResolved] = React.useState<{
    franchiseName: string | null
    outletName: string | null
  } | null>(null)
  const [resolving, setResolving] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [contact, setContact] = React.useState<ResolvedContact | null>(null)
  const [franchiseOutlets, setFranchiseOutlets] = React.useState<
    Record<string, FranchiseOutlet[]>
  >({})
  const [loadingOutlets, setLoadingOutlets] = React.useState(false)
  const [manualEntry, setManualEntry] = React.useState(false)
  const [selectedChoice, setSelectedChoice] = React.useState("")

  // The franchise is read-only when it arrived pre-filled from the contact's
  // franchise-wide mapping — changing it would leave the ticket linked to a franchise
  // the contact does not represent.
  const franchiseLocked = Boolean(fid)

  React.useEffect(() => {
    setFranchiseInput(fid ?? "")
    setOutletInput(oid ?? "")
    setSelectedChoice(fid && oid ? buildChoiceValue(fid, oid) : "")
    setManualEntry(false)
    setResult(null)
  }, [fid, oid, ticketId])

  React.useEffect(() => {
    if (!contactId) {
      setContact(null)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`/api/contacts/${contactId}`)
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as {
          contact: Omit<ResolvedContact, "mappings">
          mappings: ResolvedContact["mappings"]
        }
        if (!cancelled) {
          setContact({ ...payload.contact, mappings: payload.mappings ?? [] })
        }
      } catch (error) {
        console.error(error)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [contactId])

  const mappings = React.useMemo(() => contact?.mappings ?? [], [contact])

  // A franchise-wide mapping names a franchise, not outlets, so its outlets have to be
  // fetched before they can be offered. Only the franchise-wide ones need this —
  // outlet-specific mappings already carry the outlet's name.
  React.useEffect(() => {
    const franchiseIds = franchiseWideIds(mappings)
    if (!franchiseIds.length) {
      setFranchiseOutlets({})
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const load = async () => {
      setLoadingOutlets(true)
      try {
        const entries = await Promise.all(
          franchiseIds.map(async (franchiseId) => {
            const response = await fetch(
              `/api/merchants/${encodeURIComponent(franchiseId)}/outlets`,
              { signal: controller.signal }
            )
            if (!response.ok) {
              return [franchiseId, [] as FranchiseOutlet[]] as const
            }
            const payload = (await response.json()) as {
              outlets?: Array<{ external_id: string; name: string | null }>
            }
            return [
              franchiseId,
              (payload.outlets ?? []).map((outlet) => ({
                externalId: outlet.external_id,
                name: outlet.name,
              })),
            ] as const
          })
        )
        if (!cancelled) {
          setFranchiseOutlets(Object.fromEntries(entries))
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          if (!cancelled) {
            setFranchiseOutlets({})
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingOutlets(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [mappings])

  // A pre-filled franchise came from the contact's own franchise-wide mapping, so
  // offering outlets outside it would link the ticket to a franchise this contact does
  // not represent.
  const choices = React.useMemo(() => {
    const all = buildOutletChoices(mappings, franchiseOutlets)
    return fid ? all.filter((choice) => choice.franchiseId === fid) : all
  }, [mappings, franchiseOutlets, fid])

  const showFranchiseInLabel = spansMultipleFranchises(choices)
  const usingChoices = choices.length > 0 && !manualEntry

  const handleChoice = (value: string) => {
    const choice = choices.find((entry) => entry.value === value)
    if (!choice) {
      return
    }
    setSelectedChoice(value)
    setFranchiseInput(choice.franchiseId)
    setOutletInput(choice.outletId)
    setResult(null)
  }

  React.useEffect(() => {
    const franchiseId = franchiseInput.trim()
    const outletId = outletInput.trim()
    if (!franchiseId && !outletId) {
      setResolved(null)
      return
    }

    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setResolving(true)
      try {
        const params = new URLSearchParams()
        if (franchiseId) params.set("fid", franchiseId)
        if (outletId) params.set("oid", outletId)
        const response = await fetch(`/api/merchants/lookup?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setResolved({ franchiseName: null, outletName: null })
          return
        }
        const payload = (await response.json()) as {
          merchant?: { name?: string }
          outlet?: { name?: string }
        }
        setResolved({
          franchiseName: payload.merchant?.name ?? null,
          outletName: payload.outlet?.name ?? null,
        })
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          setResolved({ franchiseName: null, outletName: null })
        }
      } finally {
        setResolving(false)
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [franchiseInput, outletInput])

  const canSubmit =
    Boolean(franchiseInput.trim()) && Boolean(outletInput.trim()) && !saving

  const handleLink = async () => {
    if (!canSubmit) {
      return
    }

    setSaving(true)
    setResult(null)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: franchiseInput.trim(),
          oid: outletInput.trim(),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        contactMappingWritten?: boolean
        error?: string
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to link the outlet.")
      }

      const outletLabel = resolved?.outletName ?? `OID ${outletInput.trim()}`
      setResult(
        payload.contactMappingWritten
          ? `Ticket linked to ${outletLabel}. A new outlet mapping was saved on the contact, so the next ticket from them links automatically.`
          : contactId
            ? `Ticket linked to ${outletLabel}. No new contact mapping written — an existing mapping already covers this outlet.`
            : `Ticket linked to ${outletLabel}.`
      )
      showToast("Outlet linked.", "success")
      onLinked()
    } catch (error) {
      console.error(error)
      showToast(
        error instanceof Error ? error.message : "Unable to link the outlet.",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  const franchiseWideMapping = contact?.mappings.find(
    (mapping) => mapping.outletId === null
  )

  if (!needsOutletMatch) {
    return null
  }

  return (
    <>
      <div className="border-amber-500/30 bg-amber-500/5 flex items-start gap-3 rounded-lg border px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <div className="text-sm font-medium">Outlet match needed</div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {loadingOutlets
              ? "Loading the outlets mapped to this contact..."
              : choices.length
                ? franchiseWideMapping
                  ? `${contact?.name ?? "This contact"} is mapped franchise-wide to ${
                      franchiseWideMapping.franchiseName ??
                      `FID ${franchiseWideMapping.franchiseId}`
                    }. Pick the outlet this ticket is about.`
                  : `${contact?.name ?? "This contact"} is mapped to more than one outlet. Pick the one this ticket is about.`
                : contact
                  ? `${contact.name} has no outlet mapping to pick from. Enter the franchise and outlet ids to link this ticket.`
                  : "This ticket is not linked to an outlet yet. Enter the franchise and outlet ids to link it."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Link outlet</CardTitle>
            <CardDescription>
              {usingChoices
                ? "Pick from the outlets this contact is mapped to; the franchise and outlet ids are filled in for you."
                : "Enter the franchise and outlet ids; SIMS resolves the names for confirmation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {usingChoices ? (
              <Field>
                <FieldLabel htmlFor="link-outlet-choice">Outlet</FieldLabel>
                <Select value={selectedChoice} onValueChange={handleChoice}>
                  <SelectTrigger id="link-outlet-choice" className="w-full">
                    <SelectValue placeholder="Select a mapped outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {describeOutletChoice(choice, {
                          showFranchise: showFranchiseInLabel,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {`${choices.length} outlet${choices.length === 1 ? "" : "s"} mapped to this contact.`}
                  {selectedChoice
                    ? ` Links as FID ${franchiseInput.trim()} · OID ${outletInput.trim()}.`
                    : ""}
                </FieldDescription>
              </Field>
            ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="link-fid">
                  Franchise id{franchiseLocked ? " (pre-filled)" : ""}
                </FieldLabel>
                {franchiseLocked ? (
                  <div className="flex items-center gap-2">
                    <span className="bg-muted rounded-md border px-2.5 py-1.5 font-mono text-sm">
                      {franchiseInput}
                    </span>
                    <span className="text-muted-foreground text-xs">Read-only</span>
                  </div>
                ) : (
                  <Input
                    id="link-fid"
                    value={franchiseInput}
                    placeholder="e.g. 11007"
                    onChange={(event) => setFranchiseInput(event.target.value)}
                  />
                )}
                <FieldDescription>
                  {resolving
                    ? "Resolving..."
                    : resolved?.franchiseName
                      ? `Resolves to ${resolved.franchiseName}`
                      : franchiseInput.trim()
                        ? "No franchise found for this id."
                        : "Required."}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="link-oid">Outlet id</FieldLabel>
                <Input
                  id="link-oid"
                  value={outletInput}
                  placeholder="e.g. 24118"
                  onChange={(event) => setOutletInput(event.target.value)}
                />
                <FieldDescription
                  className={cn(
                    outletInput.trim() && !resolving && !resolved?.outletName
                      ? "text-destructive"
                      : undefined
                  )}
                >
                  {resolving
                    ? "Resolving..."
                    : resolved?.outletName
                      ? `Resolves to ${resolved.outletName}`
                      : outletInput.trim()
                        ? "No outlet found for this id."
                        : "Required."}
                </FieldDescription>
              </Field>
            </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!canSubmit} onClick={() => void handleLink()}>
                <Link2 />
                {saving ? "Linking..." : "Link outlet"}
              </Button>
              {choices.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualEntry((current) => !current)
                    setResult(null)
                  }}
                >
                  {manualEntry ? "Pick a mapped outlet" : "Enter ids manually"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                Change contact
              </Button>
            </div>

            {result ? (
              <div className="border-emerald-500/30 bg-emerald-500/5 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{result}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resolved contact</CardTitle>
            <CardDescription>
              Matched from the inbound Respond.io conversation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contact ? (
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground mb-1 text-xs">Contact</dt>
                  <dd>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-primary hover:underline"
                    >
                      {contact.name}
                    </Link>
                    {contact.role ? ` · ${contact.role}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1 text-xs">Phone</dt>
                  <dd>{contact.phones[0]?.phone ?? "--"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1 text-xs">
                    Mappings on file
                  </dt>
                  <dd>
                    {contact.mappings.length
                      ? contact.mappings
                          .map((mapping) =>
                            mapping.outletId === null
                              ? `Franchise-wide · ${mapping.franchiseName ?? mapping.franchiseId}`
                              : `${mapping.outletName ?? mapping.outletId} · ${
                                  mapping.franchiseName ?? mapping.franchiseId
                                }`
                          )
                          .join(", ")
                      : "None"}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="text-muted-foreground text-sm">
                No SIMS contact is linked to this ticket.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ContactPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        scope={{ fid: franchiseInput.trim() || null }}
        onSelect={(picked) => {
          // Read-only in this phase: attaching a different contact to a ticket is
          // scoped to the consuming module's own PRD (Contacts PRD 4.6 / R11). The
          // picker is here so the agent can look up who they are talking to.
          showToast(
            `${picked.name} — open the contact page to review or edit their mappings.`,
            "info"
          )
        }}
      />
    </>
  )
}
