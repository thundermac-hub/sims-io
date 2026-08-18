"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type OutletContact = {
  id: string
  name: string
  email: string
  role: string | null
  primaryPhone: string | null
  /** True when this contact is mapped to the whole franchise, not just this outlet. */
  franchiseWide: boolean
}

/**
 * Reverse lookup from an outlet to its contacts (Contacts PRD 4.5).
 *
 * Shows contacts mapped directly to the selected outlet **and** contacts mapped to the
 * parent franchise as a whole, because a franchise-wide mapping represents every outlet
 * under it — that is the whole point of the nullable `outlet_id` (AC6, AC11).
 *
 * Reuses the merchant page's existing `selectedOutletId` state rather than adding its
 * own selector, so the outlet chosen for the ticket list and for the contact list stay
 * in step.
 */
export function OutletContactsCard({
  merchantId,
  selectedOutletId,
  outletLabel,
}: {
  merchantId: string
  /** The merchant page's sentinel `"all"`, or an outlet `external_id`. */
  selectedOutletId: string
  outletLabel: string | null
}) {
  const [contacts, setContacts] = React.useState<OutletContact[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const outletId = selectedOutletId === "all" ? "" : selectedOutletId

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (outletId) {
        params.set("oid", outletId)
      }
      const query = params.toString()
      const response = await fetch(
        `/api/merchants/${encodeURIComponent(merchantId)}/contacts${query ? `?${query}` : ""}`
      )
      if (!response.ok) {
        throw new Error("Unable to load outlet contacts.")
      }
      const payload = (await response.json()) as { contacts: OutletContact[] }
      setContacts(payload.contacts ?? [])
    } catch (loadError) {
      console.error(loadError)
      setContacts([])
      setError("Unable to load outlet contacts.")
    } finally {
      setLoading(false)
    }
  }, [merchantId, outletId])

  React.useEffect(() => {
    void load()
  }, [load])

  const title = outletId
    ? `Outlet contacts — ${outletLabel ?? `OID ${outletId}`}`
    : "Franchise contacts"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {outletId
            ? "Contacts mapped directly to this outlet, plus contacts mapped to the whole franchise."
            : "Every contact mapped anywhere under this franchise. Pick an outlet above to narrow it down."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading contacts...</div>
        ) : error ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : contacts.length ? (
          <div className="flex flex-col gap-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="text-primary truncate text-sm font-medium hover:underline"
                  >
                    {contact.name}
                  </Link>
                  <span className="text-muted-foreground truncate text-xs">
                    {[contact.role, contact.primaryPhone, contact.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    contact.franchiseWide
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  )}
                >
                  {contact.franchiseWide
                    ? "Franchise-wide"
                    : outletId
                      ? "This outlet"
                      : "Outlet"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            No contacts mapped {outletId ? "to this outlet" : "under this franchise"} yet.{" "}
            <Link href="/contacts" className="underline">
              Open the contact directory
            </Link>{" "}
            to add one.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
