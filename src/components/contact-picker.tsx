"use client"

import * as React from "react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export type PickedContact = {
  id: string
  name: string
  email: string
  role: string | null
  phones: string[]
  mappingCount: number
}

/**
 * The shared contact picker (Contacts PRD 4.6).
 *
 * Sales, Renewal & Retention and Merchant Success all query the same
 * `/api/contacts/search` endpoint through this component, so "who is this person" stays
 * one answer across SIMS. Wiring a chosen contact into a Lead, Deal, Ticket or Invoice
 * is each consuming module's own concern — this component only selects.
 *
 * `scope` narrows results to a franchise or outlet; an outlet scope also matches
 * contacts mapped franchise-wide, since those represent every outlet under the
 * franchise.
 */
export function ContactPicker({
  open,
  onOpenChange,
  onSelect,
  scope,
  placeholder = "Search contacts by name, phone, or email",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (contact: PickedContact) => void
  scope?: { fid?: string | null; oid?: string | null }
  placeholder?: string
}) {
  const [query, setQuery] = React.useState("")
  // useDeferredValue rather than a timer: it yields to typing without the component
  // owning a debounce schedule. Same approach as google-place-picker.tsx.
  const deferredQuery = React.useDeferredValue(query)

  const [contacts, setContacts] = React.useState<PickedContact[]>([])
  const [loading, setLoading] = React.useState(false)

  const fid = scope?.fid ?? ""
  const oid = scope?.oid ?? ""

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setContacts([])
      return
    }

    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (deferredQuery.trim()) params.set("q", deferredQuery.trim())
        if (fid) params.set("fid", fid)
        if (oid) params.set("oid", oid)

        const response = await fetch(`/api/contacts/search?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error("Unable to search contacts.")
        }
        const payload = (await response.json()) as { contacts: PickedContact[] }
        setContacts(payload.contacts ?? [])
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error)
          setContacts([])
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [open, deferredQuery, fid, oid])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Contact picker"
      description="Search the shared SIMS contact directory"
      // Results are already filtered server-side, including by phone number. Leaving
      // cmdk's own scoring on would re-filter them and drop a phone match the server
      // found but cmdk cannot see in the rendered text.
      shouldFilter={false}
    >
      <CommandInput
        placeholder={placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching..." : "No contacts found."}
        </CommandEmpty>
        {contacts.length ? (
          <CommandGroup heading="Contacts">
            {contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                value={`${contact.id} ${contact.name} ${contact.email} ${contact.phones.join(" ")}`}
                onSelect={() => {
                  onSelect(contact)
                  onOpenChange(false)
                }}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{contact.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {[contact.phones[0], contact.email].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {contact.role ?? "No role"}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
