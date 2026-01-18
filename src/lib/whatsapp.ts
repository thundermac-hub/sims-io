export function normalizeWhatsAppNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`
}

export function stripWhatsAppPrefix(value: string | null) {
  if (!value) {
    return ""
  }
  return value.replace(/^whatsapp:/, "")
}
