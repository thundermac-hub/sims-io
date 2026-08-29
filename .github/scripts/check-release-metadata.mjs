#!/usr/bin/env node
/**
 * PR guard: enforce the repo's versioning rules, which nothing else enforces
 * for non-Claude authors:
 *   - any code change must bump package.json version
 *   - every version bump must add
 *     src/app/(app)/release-notes/content/<version>.md
 *   - documentation-only changes need no bump
 *
 * Expects to run in a checkout with the PR base available; pass the base ref
 * as argv[2] (e.g. "origin/main").
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const baseRef = process.argv[2]
if (!baseRef) {
  console.error("Usage: check-release-metadata.mjs <base-ref>")
  process.exit(2)
}

function sh(command) {
  return execSync(command, { encoding: "utf8" }).trim()
}

const mergeBase = sh(`git merge-base ${baseRef} HEAD`)
const changedFiles = sh(`git diff --name-only ${mergeBase}...HEAD`)
  .split("\n")
  .filter(Boolean)

if (changedFiles.length === 0) {
  console.log("[release-metadata] no changes; OK")
  process.exit(0)
}

const isDocFile = (file) =>
  file.startsWith("docs/") ||
  file.startsWith("audit/") ||
  file.startsWith(".github/") ||
  file.startsWith(".claude/") ||
  file.endsWith(".md")

const codeChanged = changedFiles.some((file) => !isDocFile(file))

const headVersion = JSON.parse(readFileSync("package.json", "utf8")).version
let baseVersion = null
try {
  baseVersion = JSON.parse(sh(`git show ${mergeBase}:package.json`)).version
} catch {
  console.warn("[release-metadata] could not read base package.json; skipping bump check")
}

const bumped = baseVersion !== null && headVersion !== baseVersion

if (codeChanged && baseVersion !== null && !bumped) {
  console.error(
    `[release-metadata] FAIL: code changed but package.json version is still ${headVersion}. ` +
      "Bump the version (semver) and add the matching release-notes file."
  )
  process.exit(1)
}

if (bumped) {
  const notesPath = `src/app/(app)/release-notes/content/${headVersion}.md`
  if (!existsSync(notesPath)) {
    console.error(
      `[release-metadata] FAIL: version bumped to ${headVersion} but ${notesPath} is missing.`
    )
    process.exit(1)
  }
  console.log(
    `[release-metadata] OK: ${baseVersion} -> ${headVersion}, release notes present.`
  )
} else {
  console.log("[release-metadata] OK: documentation-only change, no bump required.")
}
