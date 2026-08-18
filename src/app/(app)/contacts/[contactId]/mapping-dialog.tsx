"use client"

import * as React from "react"
import { AlertTriangle, Building2, Store } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/toast-provider"
import { classifyMappingConflict, describeMappingConflict } from "@/lib/contact-mappings"
import { cn } from "@/lib/utils"

import type { ContactMappingRow } from "../types"

type Scope = "outlet" | "franchise"

type OutletOption = {
  externalId: string
  name: string
}

/**
 * Add an outlet-specific or franchise-wide mapping.
 *
 * The agent types the franchise id and SIMS resolves the name back for confirmation,
 * matching how the Tickets module already works — there is no search-by-name step.
 * The outlet, however, is *picked* from the franchise's own outlets rather than typed:
 * an oid only means anything relative to a franchise, and the resolved list is both
 * shorter to scan and impossible to get wrong.
 *
 * The overlap rule is evaluated client-side too, using the same
 * `classifyMappingConflict` the API enforces. That is a UX affordance, not the
 * enforcement: it lets the dialog explain the conflict before a round trip and disable
 * the button, exactly as the design shows. The server re-checks inside a transaction.
 */
export function MappingDialog({
  open,
  contactId,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean
  contactId: string
  existing: ContactMappingRow[]
  onClose: () => void
  onSaved: (mappings: ContactMappingRow[]) => void
}) {
  const { showToast } = useToast()

  const [scope, setScope] = React.useState<Scope>("outlet")
  const [franchiseId, setFranchiseId] = React.useState("")
  const [outletId, setOutletId] = React.useState("")
  const [franchiseName, setFranchiseName] = React.useState<string | null>(null)
  const [outlets, setOutlets] = React.useState<OutletOption[] | null>(null)
  const [resolving, setResolving] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }
    setScope("outlet")
    setFranchiseId("")
    setOutletId("")
    setFranchiseName(null)
    setOutlets(null)
    setServerError(null)
    setSaving(false)
  }, [open])

  const effectiveOutletId = scope === "franchise" ? null : outletId.trim() || null

  // Resolve the franchise and load its outlets in one debounced pass, with the
  // in-flight requests aborted so a fast typist cannot race an older response into
  // the field. Both run on every fid change -- the outlet list is what populates the
  // dropdown, so it is not deferrable to the moment the scope switches.
  React.useEffect(() => {
    const fid = franchiseId.trim()
    if (!fid) {
      setFranchiseName(null)
      setOutlets(null)
      return
    }

    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setResolving(true)
      try {
        const [lookupResponse, outletsResponse] = await Promise.all([
          fetch(`/api/merchants/lookup?fid=${encodeURIComponent(fid)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/merchants/${encodeURIComponent(fid)}/outlets`, {
            signal: controller.signal,
          }),
        ])

        if (!lookupResponse.ok) {
          setFranchiseName(null)
          setOutlets(null)
          return
        }

        const lookup = (await lookupResponse.json()) as {
          merchant?: { name?: string }
        }
        setFranchiseName(lookup.merchant?.name ?? null)

        if (!outletsResponse.ok) {
          setOutlets([])
          return
        }
        const payload = (await outletsResponse.json()) as {
          outlets?: Array<{ external_id: string; name: string }>
        }
        setOutlets(
          (payload.outlets ?? []).map((outlet) => ({
            externalId: outlet.external_id,
            name: outlet.name,
          }))
        )
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          setFranchiseName(null)
          setOutlets(null)
        }
      } finally {
        setResolving(false)
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [franchiseId])

  // A selection made against the previous franchise's outlets is meaningless once the
  // fid changes, and would otherwise be submitted as-is.
  React.useEffect(() => {
    setOutletId("")
  }, [franchiseId])

  const conflict = franchiseId.trim()
    ? classifyMappingConflict(
        existing.map((mapping) => ({
          id: mapping.id,
          franchiseId: mapping.franchiseId,
          outletId: mapping.outletId,
          franchiseName: mapping.franchiseName,
          outletName: mapping.outletName,
        })),
        { franchiseId: franchiseId.trim(), outletId: effectiveOutletId }
      )
    : null

  const conflictMessage = conflict ? describeMappingConflict(conflict) : null

  const missingOutlet = scope === "outlet" && !outletId.trim()
  const canSubmit =
    Boolean(franchiseId.trim()) && !missingOutlet && !conflictMessage && !saving

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    setSaving(true)
    setServerError(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchiseId: franchiseId.trim(),
          outletId: effectiveOutletId,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        mappings?: ContactMappingRow[]
        error?: string
      }

      if (!response.ok || !payload.mappings) {
        setServerError(payload.error ?? "Unable to add mapping.")
        return
      }

      showToast("Mapping added.", "success")
      onSaved(payload.mappings)
    } catch (error) {
      console.error(error)
      setServerError("Unable to add mapping.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add mapping</DialogTitle>
          <DialogDescription>
            Map this contact to one outlet, or to an entire franchise.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <ScopeOption
              active={scope === "outlet"}
              icon={<Store className="size-4" />}
              title="Specific outlet"
              subtitle="Franchise + outlet"
              onSelect={() => setScope("outlet")}
            />
            <ScopeOption
              active={scope === "franchise"}
              icon={<Building2 className="size-4" />}
              title="Entire franchise"
              subtitle="Every outlet under it"
              onSelect={() => setScope("franchise")}
            />
          </div>

          <Field>
            <FieldLabel htmlFor="mapping-fid">Franchise id</FieldLabel>
            <Input
              id="mapping-fid"
              value={franchiseId}
              placeholder="e.g. 11007"
              onChange={(event) => setFranchiseId(event.target.value)}
            />
            <FieldDescription>
              {!franchiseId.trim()
                ? "Enter the merchant's FID; SIMS resolves the name for confirmation."
                : resolving
                  ? "Resolving..."
                  : franchiseName
                    ? `Resolves to ${franchiseName}`
                    : "No franchise found for this id."}
            </FieldDescription>
          </Field>

          {scope === "outlet" ? (
            <Field>
              <FieldLabel htmlFor="mapping-oid">Outlet</FieldLabel>
              <Select
                value={outletId}
                onValueChange={setOutletId}
                disabled={!franchiseName || !outlets?.length}
              >
                <SelectTrigger id="mapping-oid" className="w-full">
                  <SelectValue
                    placeholder={
                      !franchiseId.trim()
                        ? "Enter a franchise id first"
                        : resolving
                          ? "Loading outlets..."
                          : !franchiseName
                            ? "Franchise not found"
                            : outlets?.length
                              ? "Select an outlet"
                              : "This franchise has no outlets"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(outlets ?? []).map((outlet) => (
                    <SelectItem key={outlet.externalId} value={outlet.externalId}>
                      {outlet.name} · {outlet.externalId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {outlets?.length
                  ? `${outlets.length} outlet${outlets.length === 1 ? "" : "s"} under this franchise.`
                  : "Required for an outlet-specific mapping."}
              </FieldDescription>
            </Field>
          ) : (
            <div className="text-muted-foreground bg-muted/40 rounded-md border px-3 py-2 text-sm">
              A franchise-wide mapping covers every outlet under this franchise, now and
              in future.
            </div>
          )}

          {conflictMessage ? (
            <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{conflictMessage}</span>
            </div>
          ) : null}

          {serverError ? (
            <div className="text-destructive text-sm">{serverError}</div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {saving ? "Adding..." : "Add mapping"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ScopeOption({
  active,
  icon,
  title,
  subtitle,
  onSelect,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  subtitle: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "hover:bg-accent/40 border-border"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="text-muted-foreground text-xs">{subtitle}</span>
    </button>
  )
}
