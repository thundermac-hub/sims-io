/**
 * DELIMITER-aware SQL statement splitter.
 *
 * `DELIMITER` is a mysql *client* directive, not server SQL — the server
 * (and mysql2) rejects it, so migration files that use the repo's
 * `DELIMITER $$ ... END$$` idempotency idiom cannot be executed as-is.
 * This splitter turns a migration file into individual executable
 * statements, honouring:
 *   - single/double-quoted strings (backslash escapes and doubled quotes)
 *   - backtick-quoted identifiers
 *   - `-- ` and `#` line comments, and `/* ... *​/` block comments
 *   - a mutable delimiter token set by `DELIMITER <token>` lines
 *
 * Pure, no I/O — unit-tested in sql-split.test.mjs.
 */

const DELIMITER_RE = /^\s*DELIMITER\s+(\S+)\s*$/i

/**
 * Split SQL text into executable statements (delimiter lines removed,
 * statements trimmed, empty/comment-only fragments dropped).
 * @param {string} sql
 * @returns {string[]}
 */
export function splitSqlStatements(sql) {
  const text = sql.replace(/\r\n/g, "\n")
  const statements = []
  let delimiter = ";"
  let current = ""
  let i = 0
  const n = text.length
  let atLineStart = true

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed) {
      statements.push(trimmed)
    }
    current = ""
  }

  while (i < n) {
    // DELIMITER directives are only recognised at the start of a line, in
    // code context.
    if (atLineStart) {
      const lineEnd = text.indexOf("\n", i)
      const line = lineEnd === -1 ? text.slice(i) : text.slice(i, lineEnd)
      const match = DELIMITER_RE.exec(line)
      if (match) {
        // Whatever precedes a DELIMITER line must already be complete.
        flush()
        delimiter = match[1]
        i = lineEnd === -1 ? n : lineEnd + 1
        atLineStart = true
        continue
      }
    }

    const ch = text[i]

    // Statement boundary?
    if (text.startsWith(delimiter, i)) {
      flush()
      i += delimiter.length
      atLineStart = false
      continue
    }

    // Line comments: `-- ` (or `--` at EOL) and `#`.
    if (
      ch === "#" ||
      (ch === "-" &&
        text[i + 1] === "-" &&
        (i + 2 >= n || text[i + 2] === " " || text[i + 2] === "\t" || text[i + 2] === "\n"))
    ) {
      const lineEnd = text.indexOf("\n", i)
      current += lineEnd === -1 ? text.slice(i) : text.slice(i, lineEnd)
      i = lineEnd === -1 ? n : lineEnd
      continue
    }

    // Block comments.
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      const stop = end === -1 ? n : end + 2
      current += text.slice(i, stop)
      i = stop
      atLineStart = false
      continue
    }

    // Quoted regions.
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch
      let j = i + 1
      while (j < n) {
        if (quote !== "`" && text[j] === "\\") {
          j += 2
          continue
        }
        if (text[j] === quote) {
          if (text[j + 1] === quote) {
            j += 2 // doubled quote — escaped
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      current += text.slice(i, j)
      i = j
      atLineStart = false
      continue
    }

    current += ch
    atLineStart = ch === "\n"
    i += 1
  }

  flush()
  return statements
}
