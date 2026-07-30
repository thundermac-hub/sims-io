-- =============================================================================
-- Migration: 022_project_item_dependencies.sql
-- Target DB: sims-staging-platform / production (MySQL 8.0)
-- Run as:    mysql -u user -p <database> < migrations/022_project_item_dependencies.sql
--
-- Purpose:
--   Finish-to-start dependencies between project items (migration 021): a
--   successor (`item_id`) is only unblocked once its predecessor
--   (`depends_on_item_id`) reaches status 'Completed'.
--
--   The composite foreign keys onto project_items(id, project_id) make
--   "a dependency can only reference an item in the same project" a database
--   guarantee rather than an application check — this is what the
--   project_items_id_project_uk unique key added in 021 exists for.
--
--   Cycles are rejected in application code (src/lib/project-dependencies.ts)
--   inside a transaction that locks the project row, since MySQL cannot express
--   graph acyclicity as a constraint.
--
-- Column types:
--   Signed `BIGINT` throughout to match the live users.id / project_items.id —
--   see the note in migration 011.
--
-- Rollback:
--   DROP TABLE IF EXISTS project_item_dependencies;
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_item_dependencies (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT NOT NULL,
  item_id BIGINT NOT NULL,
  depends_on_item_id BIGINT NOT NULL,
  created_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_project_item_deps_item
    FOREIGN KEY (item_id, project_id)
    REFERENCES project_items(id, project_id) ON DELETE CASCADE,
  CONSTRAINT fk_project_item_deps_predecessor
    FOREIGN KEY (depends_on_item_id, project_id)
    REFERENCES project_items(id, project_id) ON DELETE CASCADE,
  CONSTRAINT fk_project_item_deps_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_project_item_deps_no_self CHECK (item_id <> depends_on_item_id),
  UNIQUE KEY project_item_deps_uk (item_id, depends_on_item_id),
  INDEX project_item_deps_reverse_idx (depends_on_item_id),
  INDEX project_item_deps_project_idx (project_id)
);
