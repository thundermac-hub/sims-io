#!/usr/bin/env node
/**
 * SIMS migration runner.
 *
 * Commands:
 *   node scripts/migrate.mjs up [--allow-checksum-drift]
 *   node scripts/migrate.mjs status [--check]
 *   node scripts/migrate.mjs baseline --through NNN --yes [--force]
 *   node scripts/migrate.mjs verify
 *   node scripts/migrate.mjs verify-idempotent --since NNN
 *
 * Design notes (deliberate):
 *  - Plain .mjs, not .ts: the deploy container runs it directly, so the
 *    runner must not depend on Node's type-stripping floor. mysql2 is a
 *    production dependency, so it is present in the image.
 *  - Connection comes from MIGRATION_DATABASE_URL (falling back to
 *    DATABASE_URL, then MYSQL_*) so the migrating identity can hold DDL
 *    privileges while the app's runtime user stays DML-only.
 *  - Every mutating command runs under GET_LOCK (Coolify can run replicas;
 *    MySQL advisory locks auto-release on disconnect).
 *  - There is NO `down` command: no existing migration has one, MySQL
 *    cannot roll back DDL, and a generated down that drops a column is a
 *    data-loss weapon. Forward-only plus restore-from-backup is the
 *    honest posture.
 *  - MySQL implicitly commits around every DDL statement, so a migration
 *    file is NOT atomic. On failure the runner stops, records nothing,
 *    prints the failing statement index, and exits non-zero — the real
 *    substitute is idempotent migrations, enforced by verify-idempotent.
 */

import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { splitSqlStatements } from "./sql-split.mjs"

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations"
)

const ADVISORY_LOCK_NAME = "sims_schema_migrations"
const ADVISORY_LOCK_TIMEOUT_SECONDS = 60

/**
 * Sentinel probes for `baseline --through NNN`: a schema shape that only
 * exists once migration NNN has been applied by hand. Baselining refuses to
 * proceed when the probe fails.
 */
const BASELINE_SENTINELS = {
  "025": {
    describe: "tickets.contact_id exists (added by 025)",
    async probe(connection) {
      const [rows] = await connection.query(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'tickets'
           AND COLUMN_NAME = 'contact_id'
         LIMIT 1`
      )
      return rows.length > 0
    },
  },
}

const ENSURE_LEDGER_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(16) NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  execution_ms INT UNSIGNED NOT NULL DEFAULT 0,
  applied_by VARCHAR(255) NOT NULL DEFAULT '',
  baseline TINYINT(1) NOT NULL DEFAULT 0
)`

function fail(message) {
  console.error(`\n[migrate] ${message}`)
  process.exit(1)
}

function checksumFile(filePath) {
  // Normalise \r\n so a checkout with different line endings does not read
  // as an edited migration.
  const bytes = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n")
  return createHash("sha256").update(bytes, "utf8").digest("hex")
}

function listMigrationFiles() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort()
  const seen = new Set()
  return files.map((filename) => {
    const version = filename.slice(0, 3)
    if (seen.has(version)) {
      fail(`Duplicate migration version ${version} (${filename}).`)
    }
    seen.add(version)
    return {
      version,
      filename,
      path: path.join(MIGRATIONS_DIR, filename),
    }
  })
}

function resolveConnectionConfig() {
  const url =
    process.env.MIGRATION_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim()
  if (url) {
    return { uri: url }
  }

  const host = process.env.MYSQL_HOST
  const user = process.env.MYSQL_USER
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DATABASE
  if (!host || !user || !database) {
    fail(
      "Set MIGRATION_DATABASE_URL (preferred), DATABASE_URL, or " +
        "MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE."
    )
  }
  return {
    host,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user,
    password,
    database,
  }
}

async function connect() {
  const mysql = await import("mysql2/promise")
  const config = resolveConnectionConfig()
  return mysql.createConnection({
    ...config,
    multipleStatements: false,
    dateStrings: true,
  })
}

async function ensureLedger(connection) {
  await connection.query(ENSURE_LEDGER_SQL)
}

async function withAdvisoryLock(connection, run) {
  const [rows] = await connection.query(`SELECT GET_LOCK(?, ?) AS got`, [
    ADVISORY_LOCK_NAME,
    ADVISORY_LOCK_TIMEOUT_SECONDS,
  ])
  if (Number(rows[0]?.got) !== 1) {
    fail(
      `Could not acquire the migration lock within ${ADVISORY_LOCK_TIMEOUT_SECONDS}s — ` +
        "is another migration run in progress?"
    )
  }
  try {
    return await run()
  } finally {
    await connection.query(`SELECT RELEASE_LOCK(?)`, [ADVISORY_LOCK_NAME])
  }
}

async function loadLedger(connection) {
  const [rows] = await connection.query(
    `SELECT version, filename, checksum, applied_at, baseline FROM schema_migrations ORDER BY version`
  )
  return new Map(rows.map((row) => [String(row.version), row]))
}

function appliedBy() {
  try {
    return `${os.userInfo().username}@${os.hostname()}`.slice(0, 255)
  } catch {
    return os.hostname().slice(0, 255)
  }
}

function checkChecksums(files, ledger, { allowDrift }) {
  const drifted = []
  for (const file of files) {
    const applied = ledger.get(file.version)
    if (!applied) continue
    const checksum = checksumFile(file.path)
    if (applied.checksum !== checksum) {
      drifted.push(file)
    }
  }
  if (drifted.length > 0) {
    const list = drifted.map((file) => `  - ${file.filename}`).join("\n")
    if (allowDrift) {
      console.warn(
        `[migrate] WARNING: checksum drift on applied migrations (allowed by --allow-checksum-drift):\n${list}`
      )
    } else {
      fail(
        `Checksum drift on applied migrations — someone edited history:\n${list}\n` +
          "Restore the original files, or re-run with --allow-checksum-drift if the edit is understood and deliberate."
      )
    }
  }
}

async function applyMigration(connection, file) {
  const sql = readFileSync(file.path, "utf8")
  const statements = splitSqlStatements(sql)
  const startedAt = Date.now()

  for (let index = 0; index < statements.length; index += 1) {
    try {
      await connection.query(statements[index])
    } catch (error) {
      console.error(
        `\n[migrate] FAILED in ${file.filename} at statement ${index + 1}/${statements.length}:`
      )
      console.error(statements[index])
      console.error(error)
      console.error(
        `\n[migrate] ${file.filename} is PARTIALLY APPLIED — inspect and repair before retrying. ` +
          "MySQL auto-commits DDL, so earlier statements in this file have taken effect. " +
          "Nothing was recorded in schema_migrations for this file, and no later files were attempted."
      )
      process.exit(1)
    }
  }

  const executionMs = Date.now() - startedAt
  await connection.query(
    `INSERT INTO schema_migrations (version, filename, checksum, execution_ms, applied_by, baseline)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [file.version, file.filename, checksumFile(file.path), executionMs, appliedBy()]
  )
  console.log(
    `[migrate] applied ${file.filename} (${statements.length} statements, ${executionMs}ms)`
  )
}

async function commandUp(flags) {
  const files = listMigrationFiles()
  const connection = await connect()
  try {
    await withAdvisoryLock(connection, async () => {
      await ensureLedger(connection)
      const ledger = await loadLedger(connection)
      checkChecksums(files, ledger, {
        allowDrift: flags.has("--allow-checksum-drift"),
      })

      const pending = files.filter((file) => !ledger.has(file.version))
      if (pending.length === 0) {
        console.log("[migrate] up to date — nothing to apply.")
        return
      }
      console.log(`[migrate] ${pending.length} migration(s) to apply.`)
      for (const file of pending) {
        await applyMigration(connection, file)
      }
      console.log("[migrate] done.")
    })
  } finally {
    await connection.end()
  }
}

async function commandStatus(flags) {
  const files = listMigrationFiles()
  const connection = await connect()
  try {
    await ensureLedger(connection)
    const ledger = await loadLedger(connection)

    let pendingCount = 0
    let driftCount = 0
    for (const file of files) {
      const applied = ledger.get(file.version)
      if (!applied) {
        pendingCount += 1
        console.log(`pending   ${file.filename}`)
        continue
      }
      const drifted = applied.checksum !== checksumFile(file.path)
      if (drifted) driftCount += 1
      const label = applied.baseline ? "baseline" : "applied "
      console.log(
        `${label}  ${file.filename}${drifted ? "  (CHECKSUM DRIFT)" : ""}`
      )
    }

    let orphanCount = 0
    const known = new Set(files.map((file) => file.version))
    for (const [version, row] of ledger) {
      if (!known.has(version)) {
        orphanCount += 1
        console.log(`MISSING FILE for ledger row ${version} (${row.filename})`)
      }
    }

    console.log(
      `\n[migrate] ${files.length} files, ${pendingCount} pending, ${driftCount} drifted, ${orphanCount} orphaned ledger rows.`
    )
    if (flags.has("--check") && (pendingCount > 0 || driftCount > 0 || orphanCount > 0)) {
      process.exit(1)
    }
  } finally {
    await connection.end()
  }
}

async function commandBaseline(flags, args) {
  const through = args.get("--through")
  if (!through || !/^\d{3}$/.test(through)) {
    fail("baseline requires --through NNN (e.g. --through 025).")
  }
  if (!flags.has("--yes")) {
    fail(
      "baseline rewrites the ledger; re-run with --yes to confirm " +
        `recording every migration up to ${through} as already applied.`
    )
  }

  const files = listMigrationFiles().filter((file) => file.version <= through)
  if (files.length === 0) {
    fail(`No migration files at or below ${through}.`)
  }

  const connection = await connect()
  try {
    await withAdvisoryLock(connection, async () => {
      const sentinel = BASELINE_SENTINELS[through]
      if (sentinel) {
        const ok = await sentinel.probe(connection)
        if (!ok) {
          fail(
            `Baseline sentinel failed: expected ${sentinel.describe}. ` +
              `This database does not look like it is at ${through}; refusing to baseline.`
          )
        }
      } else {
        console.warn(
          `[migrate] WARNING: no sentinel probe defined for ${through}; ` +
            "verify by hand that this database matches that migration level."
        )
      }

      await ensureLedger(connection)
      const ledger = await loadLedger(connection)
      if (ledger.size > 0 && !flags.has("--force")) {
        fail(
          `schema_migrations already has ${ledger.size} row(s); ` +
            "baselining is a one-time bootstrap. Use --force only if you know why."
        )
      }

      for (const file of files) {
        await connection.query(
          `INSERT INTO schema_migrations (version, filename, checksum, execution_ms, applied_by, baseline)
           VALUES (?, ?, ?, 0, ?, 1)
           ON DUPLICATE KEY UPDATE filename = VALUES(filename), checksum = VALUES(checksum), baseline = 1`,
          [file.version, file.filename, checksumFile(file.path), appliedBy()]
        )
      }
      console.log(
        `[migrate] baselined ${files.length} migration(s) through ${through}.`
      )
    })
  } finally {
    await connection.end()
  }
}

function commandVerify() {
  // Parse-only: prove the splitter can handle every file (including the
  // DELIMITER migrations). No database needed.
  const files = listMigrationFiles()
  let total = 0
  for (const file of files) {
    const statements = splitSqlStatements(readFileSync(file.path, "utf8"))
    if (statements.length === 0) {
      fail(`${file.filename}: no statements after splitting.`)
    }
    if (statements.some((statement) => /^DELIMITER/i.test(statement))) {
      fail(`${file.filename}: DELIMITER directive leaked into a statement.`)
    }
    total += statements.length
    console.log(`[migrate] ${file.filename}: ${statements.length} statements`)
  }
  console.log(`[migrate] verify OK — ${files.length} files, ${total} statements.`)
}

async function commandVerifyIdempotent(args) {
  const since = args.get("--since")
  if (!since || !/^\d{3}$/.test(since)) {
    fail("verify-idempotent requires --since NNN (e.g. --since 025).")
  }

  const files = listMigrationFiles().filter((file) => file.version > since)
  if (files.length === 0) {
    console.log(`[migrate] verify-idempotent: no migrations after ${since}.`)
    return
  }

  const connection = await connect()
  try {
    await withAdvisoryLock(connection, async () => {
      for (const file of files) {
        const statements = splitSqlStatements(readFileSync(file.path, "utf8"))
        for (let index = 0; index < statements.length; index += 1) {
          try {
            await connection.query(statements[index])
          } catch (error) {
            console.error(
              `\n[migrate] NOT IDEMPOTENT: ${file.filename} failed on re-run at statement ${index + 1}/${statements.length}:`
            )
            console.error(statements[index])
            console.error(error)
            process.exit(1)
          }
        }
        console.log(`[migrate] re-ran ${file.filename} cleanly.`)
      }
      console.log(
        `[migrate] verify-idempotent OK — ${files.length} migration(s) re-ran without error.`
      )
    })
  } finally {
    await connection.end()
  }
}

function parseCli(argv) {
  const [command, ...rest] = argv
  const flags = new Set()
  const args = new Map()
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]
    if (token === "--through" || token === "--since") {
      args.set(token, rest[i + 1])
      i += 1
    } else if (token.startsWith("--")) {
      flags.add(token)
    }
  }
  return { command, flags, args }
}

const { command, flags, args } = parseCli(process.argv.slice(2))

switch (command) {
  case "up":
    await commandUp(flags)
    break
  case "status":
    await commandStatus(flags)
    break
  case "baseline":
    await commandBaseline(flags, args)
    break
  case "verify":
    commandVerify()
    break
  case "verify-idempotent":
    await commandVerifyIdempotent(args)
    break
  default:
    console.log(
      "Usage: node scripts/migrate.mjs <up|status [--check]|baseline --through NNN --yes [--force]|verify|verify-idempotent --since NNN>"
    )
    process.exit(command ? 1 : 0)
}
