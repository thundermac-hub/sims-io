-- =============================================================================
-- Migration: 027_schema_migrations_ledger.sql
-- Target DB: sims-platform (MySQL 8.x)
--
-- Purpose:
--   The ledger for scripts/migrate.mjs — records which migrations have been
--   applied where, so "is prod on 027?" has an answer.
--
-- Notes:
--   Deliberately no foreign keys and a VARCHAR primary key: this sidesteps the
--   BIGINT signedness divergence between schema.sql and production, so the
--   runner's own table is identical in both database shapes. The runner also
--   creates this table itself at startup (it must be able to record this very
--   migration); both paths converge via IF NOT EXISTS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(16) NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  execution_ms INT UNSIGNED NOT NULL DEFAULT 0,
  applied_by VARCHAR(255) NOT NULL DEFAULT '',
  baseline TINYINT(1) NOT NULL DEFAULT 0
);
