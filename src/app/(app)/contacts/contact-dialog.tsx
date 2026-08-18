"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/toast-provider"

import type { Contact, DuplicateMatch } from "./types"

/**
 * Create / edit a contact.
 *
 * One dialog serves both modes, driven by `contact` being null or set — the repo's
 * convention (see `sales/leads`). Validation is the manual `errors` map the rest of the
 * app uses; there is no react-hook-form or zod in this project.
 */
export function ContactDialog({
  open,
  contact,
  onClose,
  onSaved,
}: {
  open: boolean
  contact: Contact | null
  onClose: () => void
  onSaved: (contact: Contact) => void
}) {
  const { showToast } = useToast()
  const isEdit = contact !== null

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [phones, setPhones] = React.useState<string[]>([""])
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [matches, setMatches] = React.useState<DuplicateMatch[]>([])
  const [saving, setSaving] = React.useState(false)

  // Reset from the record every time the dialog opens, so a cancelled edit never
  // leaks into the next one.
  React.useEffect(() => {
    if (!open) {
      return
    }
    setName(contact?.name ?? "")
    setEmail(contact?.email ?? "")
    setRole(contact?.role ?? "")
    setPhones(contact?.phones.length ? contact.phones.map((p) => p.phone) : [""])
    setErrors({})
    setMatches([])
    setSaving(false)
  }, [open, contact])

  const emailMatch = matches.find((match) => match.matchedOn === "email")
  const phoneMatch = matches.find((match) => match.matchedOn === "phone")
  // The submit button stays disabled while any duplicate stands (design: "Creation is
  // blocked while a phone number or the email matches an existing contact").
  const blocked = matches.length > 0

  const updatePhone = (index: number, value: string) => {
    setPhones((current) =>
      current.map((phone, position) => (position === index ? value : phone))
    )
    // Editing the offending field should clear its block, not leave a stale warning.
    setMatches((current) => current.filter((match) => match.matchedOn !== "phone"))
    setErrors((current) => {
      const next = { ...current }
      delete next[`phones.${index}`]
      delete next.phones
      return next
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) {
      return
    }

    setSaving(true)
    setErrors({})
    setMatches([])

    try {
      const response = await fetch(
        isEdit ? `/api/contacts/${contact.id}` : "/api/contacts",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            role: role.trim() ? role : null,
            phones: phones.filter((phone) => phone.trim()),
          }),
        }
      )

      const payload = (await response.json().catch(() => ({}))) as {
        contact?: Contact
        error?: string
        errors?: Record<string, string>
        matches?: DuplicateMatch[]
      }

      if (response.status === 409 && payload.matches?.length) {
        setMatches(payload.matches)
        return
      }

      if (!response.ok || !payload.contact) {
        setErrors(payload.errors ?? {})
        if (!payload.errors) {
          showToast(payload.error ?? "Unable to save contact.", "error")
        }
        return
      }

      showToast(isEdit ? "Contact updated." : "Contact created.", "success")
      onSaved(payload.contact)
    } catch (error) {
      console.error(error)
      showToast("Unable to save contact.", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>
            Name, email, and at least one phone number. SIMS checks both against
            existing contacts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="contact-name">Name</FieldLabel>
              <Input
                id="contact-name"
                value={name}
                aria-invalid={Boolean(errors.name) || undefined}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldError
                errors={errors.name ? [{ message: errors.name }] : undefined}
              />
            </Field>

            <Field
              data-invalid={Boolean(errors.email) || Boolean(emailMatch) || undefined}
            >
              <FieldLabel htmlFor="contact-email">Email</FieldLabel>
              <Input
                id="contact-email"
                type="email"
                value={email}
                aria-invalid={
                  Boolean(errors.email) || Boolean(emailMatch) || undefined
                }
                onChange={(event) => {
                  setEmail(event.target.value)
                  setMatches((current) =>
                    current.filter((match) => match.matchedOn !== "email")
                  )
                }}
              />
              <FieldError
                errors={errors.email ? [{ message: errors.email }] : undefined}
              />
              {emailMatch ? <DuplicateNotice match={emailMatch} /> : null}
            </Field>

            <Field data-invalid={Boolean(errors.role) || undefined}>
              <FieldLabel htmlFor="contact-role">
                Role / designation (optional)
              </FieldLabel>
              <Input
                id="contact-role"
                value={role}
                aria-invalid={Boolean(errors.role) || undefined}
                onChange={(event) => setRole(event.target.value)}
              />
              <FieldError
                errors={errors.role ? [{ message: errors.role }] : undefined}
              />
            </Field>

            <Field data-invalid={Boolean(errors.phones) || Boolean(phoneMatch) || undefined}>
              <FieldLabel>Phone numbers</FieldLabel>
              <FieldDescription>First number is primary.</FieldDescription>
              <div className="flex flex-col gap-2">
                {phones.map((phone, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={phone}
                      placeholder={index === 0 ? "+60 12-345 6789" : "Add another number"}
                      aria-invalid={
                        Boolean(errors[`phones.${index}`]) ||
                        (index === 0 && Boolean(phoneMatch)) ||
                        undefined
                      }
                      onChange={(event) => updatePhone(index, event.target.value)}
                    />
                    {phones.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove phone number"
                        onClick={() =>
                          setPhones((current) =>
                            current.filter((_, position) => position !== index)
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {phones.some((phone, index) => errors[`phones.${index}`]) ? (
                  <div className="text-destructive text-sm">
                    {phones
                      .map((_, index) => errors[`phones.${index}`])
                      .filter(Boolean)
                      .join(" ")}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setPhones((current) => [...current, ""])}
                >
                  <Plus />
                  Add number
                </Button>
              </div>
              <FieldError
                errors={errors.phones ? [{ message: errors.phones }] : undefined}
              />
              {phoneMatch ? <DuplicateNotice match={phoneMatch} /> : null}
            </Field>

            {blocked ? (
              <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                {isEdit
                  ? "Saving is blocked while a phone number or the email matches another contact."
                  : "Creation is blocked while a phone number or the email matches an existing contact."}
              </div>
            ) : null}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={blocked || saving}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The inline "Already used by ..." state from the design, naming the existing contact
 * as a link so staff can open it instead of fighting the form.
 */
function DuplicateNotice({ match }: { match: DuplicateMatch }) {
  const descriptor = match.role ? ` (${match.role})` : ""

  return (
    <div className="text-destructive flex items-start gap-2 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>
        Already used by{" "}
        <Link href={`/contacts/${match.contactId}`} className="font-medium underline">
          {match.name}
        </Link>
        {descriptor}. Use that contact instead of creating a duplicate.
      </span>
    </div>
  )
}
