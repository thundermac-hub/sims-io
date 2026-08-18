/**
 * Phone number normalization and comparison.
 *
 * Deliberately its own module with no imports: both the client-side Contacts UI and the
 * server-side Respond.io resolution need these, and keeping them here stops
 * `respondio-resolution.ts` — which imports `node:crypto` — from being dragged into the
 * browser bundle by anything that only wanted to format a phone number.
 */

/**
 * Strip a phone number to a comparable form: digits only, with a leading `+` preserved
 * when present.
 *
 * Duplicate detection and Respond.io phone matching must both be format-insensitive --
 * "+60 16-220 7781", "+60162207781" and "+6016-2207781" are one number. Returns an
 * empty string when there are no digits at all, which callers treat as "no usable
 * phone".
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) {
    return ""
  }

  const trimmed = input.trim()
  const digits = trimmed.replace(/[^0-9]/g, "")
  if (!digits) {
    return ""
  }

  return trimmed.startsWith("+") ? `+${digits}` : digits
}

/**
 * Reduce a number to its subscriber digits, dropping a Malaysian country code and then
 * a national trunk zero.
 *
 * `+60162207781`, `60162207781` and `0162207781` are all the same subscriber, so a plain
 * compare of the normalized values is not enough.
 */
export function toSubscriberDigits(value: string): string {
  let digits = normalizePhone(value).replace(/^\+/, "")
  if (!digits) {
    return ""
  }

  if (digits.startsWith("60")) {
    digits = digits.slice(2)
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1)
  }

  return digits
}

/** True when two numbers reach the same subscriber, in any of the accepted formats. */
export function phonesMatch(left: string, right: string): boolean {
  const a = toSubscriberDigits(left)
  const b = toSubscriberDigits(right)
  return Boolean(a) && a === b
}
