/**
 * One grammar, one parser for MinIO object keys.
 *
 * Every key this application writes has exactly three segments:
 *
 *   <prefix>/<owner>/<timestamp>-<random>.<ext>
 *
 * where `prefix` is an allowlisted folder, `owner` is the uploading user's
 * numeric id (or the literal "public" for the unauthenticated support form),
 * and the stem is the `Date.now()-randomInt` pair `buildObjectKey` emits.
 *
 * Anything else — path traversal, empty segments, backslashes, extra
 * segments, absurd lengths — is rejected before a key ever reaches S3 or a
 * SQL lookup. The three-segment rule alone kills `x.evil/../../foo`.
 */

export const OBJECT_KEY_PREFIXES = ["avatars", "uploads", "support-form"] as const
export type ObjectKeyPrefix = (typeof OBJECT_KEY_PREFIXES)[number]

export const MAX_OBJECT_KEY_LENGTH = 256

export type ParsedObjectKey = {
  key: string
  prefix: ObjectKeyPrefix
  /** Numeric user id as a string, or "public" for support-form uploads. */
  owner: string
  /** File stem, `<timestamp>-<random>`. */
  stem: string
  /** Lowercase extension without the dot, e.g. "png". Empty when absent. */
  extension: string
}

const OWNER_PATTERN = /^(?:\d{1,20}|public)$/
const STEM_PATTERN = /^\d{10,16}-\d{1,12}$/
const EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/

function isObjectKeyPrefix(value: string): value is ObjectKeyPrefix {
  return (OBJECT_KEY_PREFIXES as readonly string[]).includes(value)
}

/** Parse and validate an object key. Returns `null` for anything malformed. */
export function parseObjectKey(value: unknown): ParsedObjectKey | null {
  if (typeof value !== "string") {
    return null
  }

  const key = value.trim()
  if (!key || key.length > MAX_OBJECT_KEY_LENGTH) {
    return null
  }
  if (key.includes("..") || key.includes("//") || key.includes("\\")) {
    return null
  }

  const segments = key.split("/")
  if (segments.length !== 3) {
    return null
  }

  const [prefix, owner, filename] = segments
  if (!isObjectKeyPrefix(prefix)) {
    return null
  }
  if (!OWNER_PATTERN.test(owner)) {
    return null
  }

  const dotIndex = filename.lastIndexOf(".")
  const stem = dotIndex === -1 ? filename : filename.slice(0, dotIndex)
  const extension = dotIndex === -1 ? "" : filename.slice(dotIndex + 1)

  if (!STEM_PATTERN.test(stem)) {
    return null
  }
  if (extension && !EXTENSION_PATTERN.test(extension)) {
    return null
  }

  return { key, prefix, owner, stem, extension }
}
