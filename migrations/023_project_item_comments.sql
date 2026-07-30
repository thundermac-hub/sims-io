-- =============================================================================
-- Migration: 023_project_item_comments.sql
-- Target DB: sims-staging-platform / production (MySQL 8.0)
-- Run as:    mysql -u user -p <database> < migrations/023_project_item_comments.sql
--
-- Purpose:
--   Comments on project phases and activities (migration 021), including
--   @mentions.
--
--   Mentions are NOT a separate table. They are stored inline in `body` as
--   canonical `@[Display Name](userId)` markers and resolved by a pure parser
--   (src/lib/project-comments.ts) at write time — which validates that each
--   mentioned user actually has access to the project and drops the rest — and
--   again at render time. A join table would only buy a "mentions of me" inbox,
--   which is not in scope.
--
--   Comments survive their item being soft-deleted: soft delete only sets
--   project_items.deleted_at, so these rows are untouched and remain retrievable
--   for audit. The ON DELETE CASCADE below only fires on a hard delete of the
--   project or item, which the application never performs.
--
-- Column types:
--   Signed `BIGINT` throughout to match the live users.id / project_items.id —
--   see the note in migration 011.
--
-- Rollback:
--   DROP TABLE IF EXISTS project_item_comments;
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_item_comments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT NOT NULL,
  item_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  created_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_project_item_comments_item
    FOREIGN KEY (item_id, project_id)
    REFERENCES project_items(id, project_id) ON DELETE CASCADE,
  CONSTRAINT fk_project_item_comments_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX project_item_comments_item_idx (item_id, created_at),
  INDEX project_item_comments_project_idx (project_id, created_at)
);
