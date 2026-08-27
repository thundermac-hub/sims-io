/**
 * The CSAT survey message a merchant receives.
 *
 * Single source of truth for the copy, shared by the two paths that send it: the
 * automatic send when a ticket is closed (`src/lib/respondio-csat.ts`) and the manual
 * WhatsApp share button on the tickets page. It used to be duplicated in both, which
 * meant a wording change silently applied to only one.
 *
 * Deliberately import-free and free of server-only APIs, so the client-side tickets
 * page can import it without pulling anything else into the browser bundle.
 */

/** The sentences before the link. One paragraph, as it reads in chat. */
const CSAT_MESSAGE_BODY = [
  "Hi! Thanks for contacting Merchant Success.",
  "We would love to hear your feedback.",
  "Please take a moment to share your experience with us.",
].join(" ")

/**
 * Compose the message, with the link on its own line.
 *
 * The blank line matters for more than looks: WhatsApp builds its link preview from the
 * first URL in the message, and a URL sitting alone on the last line is both easier to
 * tap and unambiguous to parse. Nothing may follow it — trailing text after the link is
 * what most often stops a preview from rendering.
 */
export function buildCsatMessage(csatUrl: string): string {
  return `${CSAT_MESSAGE_BODY}\n\n${csatUrl}`
}
