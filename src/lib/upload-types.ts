/**
 * Per-folder upload allowlists with magic-byte sniffing.
 *
 * The sniffed type wins: it determines both the stored Content-Type and the
 * object-key extension, so a `.png` that is really HTML never gets stored
 * (or later served) as anything the sniffer did not verify. Container
 * formats that share magic bytes (ZIP → xlsx/docx, OLE → xls/doc) are
 * disambiguated by the claimed filename extension, which is safe because
 * every member of the family gets the same non-executable treatment.
 */

import {
  OBJECT_KEY_PREFIXES,
  type ObjectKeyPrefix,
} from "./storage-keys.ts"

export type ResolvedUploadType = {
  mime: string
  /** Key extension without the dot. */
  extension: string
}

export type UploadTypeResult =
  | { ok: true; type: ResolvedUploadType }
  | { ok: false; error: string }

// Upload folders ARE the object-key prefixes — one tuple, one source of
// truth, so the write path and the read path can never disagree about what
// a valid key looks like.
export const UPLOAD_FOLDERS = OBJECT_KEY_PREFIXES
export type UploadFolder = ObjectKeyPrefix

/**
 * The single extension → Content-Type table. The sniffer's results, the
 * folder allowlists, and the uploads/view response headers all derive from
 * it, so adding a type is a one-place change.
 */
export const EXTENSION_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Legacy-only types: not uploadable anymore, but objects stored before the
  // allowlist existed must stay servable. SVG is deliberately absent — an
  // inline SVG can carry script, which is the stored-XSS vector this table
  // exists to close; legacy .svg objects download as octet-stream instead.
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  mp4: "video/mp4",
  mov: "video/quicktime",
  txt: "text/plain",
} as const

/** Extensions safe to render inline in the browser; the rest download. */
export const INLINE_EXTENSIONS: ReadonlySet<string> = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "gif",
  "bmp",
  "pdf",
])

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic"]

/** Allowed sniffed MIME types per folder. */
const FOLDER_ALLOWLISTS: Record<UploadFolder, readonly string[]> = {
  avatars: IMAGE_MIMES,
  uploads: [
    ...IMAGE_MIMES,
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  // The pre-existing (unauthenticated) support-form allowlist, unchanged.
  "support-form": ["image/jpeg", "image/png", "image/heic", "application/pdf"],
}

/** `accept` attribute values for the file pickers, per folder. */
export const FOLDER_ACCEPT_ATTRIBUTES: Record<UploadFolder, string> = {
  avatars: ".jpg,.jpeg,.png,.webp,.heic,image/jpeg,image/png,image/webp,image/heic",
  uploads:
    ".jpg,.jpeg,.png,.webp,.heic,.pdf,.xlsx,.xls,.csv,.doc,.docx," +
    "image/jpeg,image/png,image/webp,image/heic,application/pdf," +
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
    "application/vnd.ms-excel,text/csv,application/msword," +
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "support-form": ".jpg,.jpeg,.png,.heic,.pdf,image/jpeg,image/png,image/heic,application/pdf",
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) {
    return false
  }
  return signature.every((value, index) => bytes[offset + index] === value)
}

function claimedExtension(filename: string | undefined): string {
  if (!filename || !filename.includes(".")) {
    return ""
  }
  return filename.split(".").pop()!.toLowerCase()
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4096)
  for (const byte of sample) {
    if (byte === 0) {
      return false
    }
  }
  return true
}

/**
 * Identify the file type from its bytes. Returns `null` when the content
 * matches nothing on the known-type list.
 */
export function sniffUploadType(
  bytes: Uint8Array,
  filename?: string
): ResolvedUploadType | null {
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" }
  }
  // WebP: RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mime: "image/webp", extension: "webp" }
  }
  // HEIC/HEIF: "ftyp" at offset 4 with a heif-family brand
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) && bytes.length >= 12) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase()
    if (["heic", "heix", "heif", "mif1", "msf1", "hevc"].includes(brand)) {
      return { mime: "image/heic", extension: "heic" }
    }
    return null
  }
  // PDF: %PDF-
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: "application/pdf", extension: "pdf" }
  }
  // ZIP container: PK 03 04 — OOXML (xlsx/docx), split by claimed extension
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = claimedExtension(filename)
    if (ext === "xlsx") {
      return {
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
      }
    }
    if (ext === "docx") {
      return {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: "docx",
      }
    }
    return null
  }
  // OLE compound file: D0 CF 11 E0 A1 B1 1A E1 — legacy xls/doc
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const ext = claimedExtension(filename)
    if (ext === "xls") {
      return { mime: "application/vnd.ms-excel", extension: "xls" }
    }
    if (ext === "doc") {
      return { mime: "application/msword", extension: "doc" }
    }
    return null
  }
  // CSV has no magic bytes: require the claimed extension AND text content.
  if (claimedExtension(filename) === "csv" && looksLikeText(bytes)) {
    return { mime: "text/csv", extension: "csv" }
  }

  return null
}

/**
 * Resolve and authorize an upload for a folder. The error strings are
 * user-facing (the public support form shows them verbatim).
 */
export function resolveUploadType(
  folder: UploadFolder,
  bytes: Uint8Array,
  filename?: string
): UploadTypeResult {
  const sniffed = sniffUploadType(bytes, filename)
  if (!sniffed || !FOLDER_ALLOWLISTS[folder].includes(sniffed.mime)) {
    return {
      ok: false,
      error:
        folder === "avatars"
          ? "Unsupported file type. Avatars must be a JPEG, PNG, WebP, or HEIC image."
          : folder === "support-form"
            ? "Unsupported file type. Use JPEG, PNG, HEIC, or PDF."
            : "Unsupported file type. Use an image, PDF, spreadsheet, or Word document.",
    }
  }
  return { ok: true, type: sniffed }
}
