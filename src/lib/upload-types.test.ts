import assert from "node:assert/strict"
import test from "node:test"

import { resolveUploadType, sniffUploadType } from "./upload-types.ts"

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
const OLE = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const HTML = Uint8Array.from(Buffer.from("<html><script>alert(1)</script>"))

test("sniffed type wins over the claimed filename", () => {
  // A PNG renamed .html is still a PNG.
  assert.deepEqual(sniffUploadType(PNG, "evil.html"), {
    mime: "image/png",
    extension: "png",
  })
  assert.deepEqual(sniffUploadType(JPEG, "photo.png"), {
    mime: "image/jpeg",
    extension: "jpg",
  })
})

test("real HTML matches nothing", () => {
  assert.equal(sniffUploadType(HTML, "page.html"), null)
  const asUpload = resolveUploadType("uploads", HTML, "page.html")
  assert.equal(asUpload.ok, false)
})

test("zip and ole containers split on the claimed extension", () => {
  assert.equal(sniffUploadType(ZIP, "report.xlsx")?.extension, "xlsx")
  assert.equal(sniffUploadType(ZIP, "letter.docx")?.extension, "docx")
  assert.equal(sniffUploadType(ZIP, "archive.zip"), null)
  assert.equal(sniffUploadType(OLE, "old.xls")?.mime, "application/vnd.ms-excel")
  assert.equal(sniffUploadType(OLE, "old.doc")?.mime, "application/msword")
  assert.equal(sniffUploadType(OLE, "old.bin"), null)
})

test("csv requires the extension and text content", () => {
  const csv = Uint8Array.from(Buffer.from("a,b,c\n1,2,3\n"))
  assert.equal(sniffUploadType(csv, "data.csv")?.mime, "text/csv")
  assert.equal(sniffUploadType(csv, "data.txt"), null)
  const binary = Uint8Array.from([0x00, 0x01, 0x02])
  assert.equal(sniffUploadType(binary, "data.csv"), null)
})

test("folder allowlists differ", () => {
  assert.equal(resolveUploadType("avatars", PNG, "a.png").ok, true)
  assert.equal(resolveUploadType("avatars", PDF, "a.pdf").ok, false)
  assert.equal(resolveUploadType("uploads", PDF, "a.pdf").ok, true)
  assert.equal(resolveUploadType("uploads", ZIP, "a.xlsx").ok, true)
  assert.equal(resolveUploadType("support-form", ZIP, "a.xlsx").ok, false)
  assert.equal(resolveUploadType("support-form", PDF, "a.pdf").ok, true)
})
