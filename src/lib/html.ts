/**
 * Escape a string for interpolation into HTML text or attribute values.
 * The single shared copy — escaping is security-sensitive, so it must not
 * drift between callers (auth emails, notification emails, OAuth pages).
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
