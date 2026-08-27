import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { splitSqlStatements } from "./sql-split.mjs"

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations"
)

test("splits plain statements on semicolons", () => {
  const statements = splitSqlStatements(
    "CREATE TABLE a (id INT);\nINSERT INTO a VALUES (1);\n"
  )
  assert.deepEqual(statements, [
    "CREATE TABLE a (id INT)",
    "INSERT INTO a VALUES (1)",
  ])
})

test("honours DELIMITER blocks and restores the default", () => {
  const statements = splitSqlStatements(`
DROP PROCEDURE IF EXISTS _p;

DELIMITER $$

CREATE PROCEDURE _p()
BEGIN
  IF 1 = 1 THEN
    SELECT 1;
  END IF;
END$$

DELIMITER ;

CALL _p();
DROP PROCEDURE IF EXISTS _p;
`)
  assert.equal(statements.length, 4)
  assert.match(statements[1], /^CREATE PROCEDURE _p\(\)/)
  assert.match(statements[1], /SELECT 1;\s*\n\s*END IF;\s*\nEND$/)
  assert.equal(statements[2], "CALL _p()")
})

test("ignores delimiters inside strings, identifiers, and comments", () => {
  const statements = splitSqlStatements(`
INSERT INTO t (a) VALUES ('semi;colon');
SELECT 1; -- trailing; comment
# hash; comment
/* block; comment */
SELECT \`weird;column\` FROM t;
SELECT 'escaped \\' quote; still string';
`)
  assert.equal(statements.length, 4)
  assert.equal(statements[0], "INSERT INTO t (a) VALUES ('semi;colon')")
  assert.match(statements[3], /still string'$/)
})

test("DELIMITER is only recognised at line start", () => {
  const statements = splitSqlStatements("SELECT 'DELIMITER $$';\nSELECT 2;\n")
  assert.equal(statements.length, 2)
})

test("splits every real migration without leaving DELIMITER residue", () => {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
  assert.ok(files.length >= 26, "expected the migration corpus")

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8")
    const statements = splitSqlStatements(sql)
    assert.ok(statements.length > 0, `${file}: no statements`)
    for (const statement of statements) {
      assert.doesNotMatch(
        statement,
        /^DELIMITER/i,
        `${file}: DELIMITER directive leaked into a statement`
      )
    }
  }
})

test("acceptance: migration 003 splits into complete procedure bodies", () => {
  const sql = readFileSync(
    path.join(migrationsDir, "003_prod_schema_alignment.sql"),
    "utf8"
  )
  const statements = splitSqlStatements(sql)
  const procedures = statements.filter((statement) =>
    /^CREATE\s+PROCEDURE/i.test(statement)
  )
  assert.ok(procedures.length >= 1, "expected procedure definitions")
  for (const procedure of procedures) {
    assert.match(procedure, /END$/i)
    // The body's internal semicolons must survive inside the procedure.
    assert.ok(procedure.includes(";"), "procedure body lost its statements")
  }
})
