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
import { useToast } from "@/components/toast-provider"
import { classifyMappingConflict, describeMappingConflict } from "@/lib/contact-mappings"
import { cn } from "@/lib/utils"

import type { ContactMappingRow } from "../types"

type Scope = "outlet" | "franchise"

type ResolvedNames = {
  franchiseName: string | null
  outletName: string | null
}

/**
 * Add an outlet-specific or franchise-wide mapping.
 *
 * The agent types the franchise and outlet ids directly and SIMS resolves the names
 * back for confirmation, matching how the Tickets module already works — there is no
 * search-by-name step.
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
  const [resolved, setResolved] = React.useState<ResolvedNames | null>(null)
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
    setResolved(null)
    setServerError(null)
    setSaving(false)
  }, [open])

  const effectiveOutletId = scope === "franchise" ? null : outletId.trim() || null

  // Resolve ids to names for confirmation, debounced, with the in-flight request
  // aborted so a fast typist does not race an older response into the field.
  React.useEffect(() => {
    const fid = franchiseId.trim()
    if (!fid) {
      setResolved(null)
      return
    }

    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setResolving(true)
      try {
        const params = new URLSearchParams({ fid })
        if (effectiveOutletId) {
          params.set("oid", effectiveOutletId)
        }
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
  }, [franchiseId, effectiveOutletId])

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
                  : resolved?.franchiseName
                    ? `Resolves to ${resolved.franchiseName}`
                    : "No franchise found for this id."}
            </FieldDescription>
          </Field>

          {scope === "outlet" ? (
            <Field>
              <FieldLabel htmlFor="mapping-oid">Outlet id</FieldLabel>
              <Input
                id="mapping-oid"
                value={outletId}
                placeholder="e.g. 24118"
                onChange={(event) => setOutletId(event.target.value)}
              />
              <FieldDescription>
                {!outletId.trim()
                  ? "Required for an outlet-specific mapping."
                  : resolving
                    ? "Resolving..."
                    : resolved?.outletName
                      ? `Resolves to ${resolved.outletName}`
                      : "No outlet found under this franchise for this id."}
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
