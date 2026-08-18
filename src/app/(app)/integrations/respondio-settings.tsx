"use client"

import * as React from "react"
import { Copy, KeyRound, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/toast-provider"
import { formatDateTime } from "@/lib/dates"

type SecretSummary = {
  keyId: string
  masked: string
  createdAt: string
  createdBy: string | null
  lastUsedAt: string | null
}

type SettingsPayload = {
  settings: { routingTag: string; updatedAt: string | null; updatedBy: string | null }
  canManageSecrets: boolean
  secrets: SecretSummary[]
  endpoint: string
  secretHeader: string
}

export function RespondioSettings() {
  const { showToast } = useToast()

  const [data, setData] = React.useState<SettingsPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [routingTag, setRoutingTag] = React.useState("")
  const [savingTag, setSavingTag] = React.useState(false)

  const [confirmRotate, setConfirmRotate] = React.useState(false)
  const [rotating, setRotating] = React.useState(false)
  // Held only in component state, only until this page unmounts. The raw secret exists
  // in exactly one response body and is never recoverable afterwards.
  const [issuedSecret, setIssuedSecret] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/integrations/respond-io/settings")
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Unable to load integration settings.")
      }
      const payload = (await response.json()) as SettingsPayload
      setData(payload)
      setRoutingTag(payload.settings.routingTag)
    } catch (loadError) {
      console.error(loadError)
      setData(null)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load integration settings."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleSaveTag = async () => {
    setSavingTag(true)
    try {
      const response = await fetch("/api/integrations/respond-io/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routingTag }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save settings.")
      }
      showToast("Routing tag saved.", "success")
      await load()
    } catch (saveError) {
      console.error(saveError)
      showToast(
        saveError instanceof Error ? saveError.message : "Unable to save settings.",
        "error"
      )
    } finally {
      setSavingTag(false)
    }
  }

  const handleRotate = async () => {
    setRotating(true)
    try {
      const response = await fetch("/api/integrations/respond-io/secret", {
        method: "POST",
      })
      const payload = (await response.json().catch(() => ({}))) as {
        secret?: string
        error?: string
      }
      if (!response.ok || !payload.secret) {
        throw new Error(payload.error ?? "Unable to issue a new secret.")
      }
      setIssuedSecret(payload.secret)
      showToast("New shared secret issued.", "success")
      await load()
    } catch (rotateError) {
      console.error(rotateError)
      showToast(
        rotateError instanceof Error
          ? rotateError.message
          : "Unable to issue a new secret.",
        "error"
      )
    } finally {
      setRotating(false)
      setConfirmRotate(false)
    }
  }

  const handleCopy = async () => {
    if (!issuedSecret) {
      return
    }
    try {
      await navigator.clipboard.writeText(issuedSecret)
      showToast("Secret copied to clipboard.", "success")
    } catch (copyError) {
      console.error(copyError)
      showToast("Unable to copy. Select the value and copy it manually.", "error")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-sm">
          Loading integration settings...
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-sm">
          <span className="text-destructive">{error ?? "Unavailable."}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Respond.io settings</CardTitle>
        <CardDescription>
          Shared secret and Merchant Success routing tag.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <div className="text-muted-foreground mb-2 text-xs">Shared secret</div>

          {issuedSecret ? (
            <div className="border-primary/40 bg-primary/5 flex flex-col gap-2 rounded-md border px-3 py-3">
              <div className="text-sm font-medium">
                Copy this now — it is shown only once.
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-background min-w-0 flex-1 truncate rounded border px-2 py-1.5 font-mono text-xs">
                  {issuedSecret}
                </code>
                <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
                  <Copy />
                  Copy
                </Button>
              </div>
              <div className="text-muted-foreground text-xs">
                Only a SHA-256 hash is stored, so there is no way to reveal it again.
                Paste it into the n8n credential now; rotate to issue a replacement.
              </div>
            </div>
          ) : null}

          {data.secrets.length ? (
            <div className="mt-3 flex flex-col gap-2">
              {data.secrets.map((secret) => (
                <div
                  key={secret.keyId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <KeyRound className="text-muted-foreground size-4 shrink-0" />
                    <code className="font-mono text-xs">{secret.masked}</code>
                    <span className="text-muted-foreground text-xs">
                      key {secret.keyId}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Issued {formatDateTime(secret.createdAt)}
                    {secret.createdBy ? ` by ${secret.createdBy}` : ""}
                    {secret.lastUsedAt
                      ? ` · last used ${formatDateTime(secret.lastUsedAt)}`
                      : " · never used"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground mt-1 text-sm">
              No shared secret issued yet. n8n cannot authenticate until one exists.
            </div>
          )}

          {data.canManageSecrets ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setConfirmRotate(true)}
            >
              <RotateCcw />
              {data.secrets.length ? "Rotate secret" : "Issue secret"}
            </Button>
          ) : (
            <div className="text-muted-foreground mt-3 text-xs">
              Only an Admin can issue or rotate the shared secret.
            </div>
          )}
        </div>

        <Separator />

        <Field>
          <FieldLabel htmlFor="routing-tag">Merchant Success routing tag</FieldLabel>
          <Input
            id="routing-tag"
            value={routingTag}
            disabled={!data.canManageSecrets}
            onChange={(event) => setRoutingTag(event.target.value)}
          />
          <FieldDescription>
            A Contact Tag Updated event only creates a ticket when its tag matches this
            value exactly (case-insensitive).
            {data.settings.updatedBy
              ? ` Last changed by ${data.settings.updatedBy}.`
              : ""}
          </FieldDescription>
        </Field>

        <div className="text-muted-foreground flex flex-col gap-1 rounded-md border px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span>Inbound endpoint</span>
            <code className="text-foreground font-mono">{data.endpoint}</code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Secret header</span>
            <code className="text-foreground font-mono">{data.secretHeader}</code>
          </div>
        </div>

        {data.canManageSecrets ? (
          <Button
            size="sm"
            className="self-start"
            disabled={savingTag || !routingTag.trim()}
            onClick={() => void handleSaveTag()}
          >
            {savingTag ? "Saving..." : "Save settings"}
          </Button>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={data.secrets.length ? "Rotate the shared secret?" : "Issue a shared secret?"}
        description={
          data.secrets.length
            ? "A new secret is issued and shown once. The previous secret keeps working as a grace window so n8n can be updated without dropping events, but the oldest key beyond two is revoked immediately."
            : "A new secret is issued and shown once. Paste it into the n8n credential — it cannot be revealed again."
        }
        confirmLabel={data.secrets.length ? "Rotate secret" : "Issue secret"}
        loading={rotating}
        onConfirm={handleRotate}
      />
    </Card>
  )
}
