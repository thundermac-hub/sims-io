-- =============================================================================
-- Migration: 021_project_tracker_items.sql
-- Target DB: sims-staging-platform / production (MySQL 8.0)
-- Run as:    mysql -u user -p <database> < migrations/021_project_tracker_items.sql
--
-- Purpose:
--   Adds phases and activities to the Project Tracker (migration 020).
--
--   Phases and activities live in ONE table with a self-referential
--   `parent_item_id`: a Phase has no parent, an Activity must have one. Both
--   dependencies (022) and comments (023) must be able to target either kind, and
--   a single table lets those tables carry one real FK per reference instead of
--   pairs of nullable ones, keeps soft delete and status updates on one code
--   path, and makes the dependency graph a single edge set to traverse.
--
--   Soft delete is a `deleted_at` flag and is never cascaded to children: an item
--   is effectively deleted when its own or its parent's `deleted_at` is set. That
--   way restoring a phase restores exactly the children that were not deleted
--   individually, with no extra bookkeeping.
--
-- Column types:
--   The live `users.id` is a signed `BIGINT` (the schema.sql snapshot declares it
--   UNSIGNED, but the deployed databases drifted to signed). MySQL requires
--   foreign-key columns to match the referenced column's signedness exactly, so
--   every new id / FK column below is signed `BIGINT` (NOT UNSIGNED). See
--   migration 011 for the original note.
--
-- Rollback:
--   DROP TABLE IF EXISTS project_items;
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT NOT NULL,
  parent_item_id BIGINT DEFAULT NULL,
  item_type ENUM('Phase', 'Activity') NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('Not Started', 'In Progress', 'Blocked', 'Completed')
    NOT NULL DEFAULT 'Not Started',
  assigned_user_id BIGINT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  due_date DATE DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at DATETIME(3) DEFAULT NULL,
  deleted_at DATETIME(3) DEFAULT NULL,
  deleted_by_user_id BIGINT DEFAULT NULL,
  created_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_project_items_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  -- No ON DELETE action on the self-reference: InnoDB self-referential cascades
  -- are a known footgun and hard deletes are out of scope (deletion is a flag).
  CONSTRAINT fk_project_items_parent
    FOREIGN KEY (parent_item_id) REFERENCES project_items(id),
  CONSTRAINT fk_project_items_assigned_user
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_project_items_deleted_by
    FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_project_items_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_project_items_shape CHECK (
    (item_type = 'Phase' AND parent_item_id IS NULL)
    OR (item_type = 'Activity' AND parent_item_id IS NOT NULL)
  ),
  -- Lets dependency and comment rows use composite FKs (id, project_id), making
  -- "must be within the same project" a database guarantee.
  UNIQUE KEY project_items_id_project_uk (id, project_id),
  INDEX project_items_tree_idx (project_id, parent_item_id, sort_order),
  INDEX project_items_assigned_idx (assigned_user_id),
  INDEX project_items_status_idx (project_id, status),
  INDEX project_items_live_idx (project_id, deleted_at)
);
