-- =============================================================================
-- Migration: 020_project_tracker_projects.sql
-- Target DB: sims-staging-platform / production (MySQL 8.0)
-- Run as:    mysql -u user -p <database> < migrations/020_project_tracker_projects.sql
--
-- Purpose:
--   Introduces the Project Tracker module (P&E project progress tracking):
--     1. projects        — one row per tracked project, creator becomes Owner
--     2. project_members — per-project access control (Owner / Editor / Viewer)
--
--   Phases, activities, dependencies and comments arrive in migrations 021-023.
--
-- Column types:
--   The live `users.id` is a signed `BIGINT` (the schema.sql snapshot declares it
--   UNSIGNED, but the deployed databases drifted to signed). MySQL requires
--   foreign-key columns to match the referenced column's signedness exactly, so
--   every new id / FK column below is signed `BIGINT` (NOT UNSIGNED) to match the
--   live tables. See migration 011 for the original note.
--
-- Rollback:
--   DROP TABLE IF EXISTS project_members;
--   DROP TABLE IF EXISTS projects;
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT DEFAULT NULL,
  start_date DATE NOT NULL,
  created_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_projects_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX projects_created_at_idx (created_at)
);

CREATE TABLE IF NOT EXISTS project_members (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role ENUM('Owner', 'Editor', 'Viewer') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_project_members_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_members_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY project_members_project_user_uk (project_id, user_id),
  INDEX project_members_user_idx (user_id, project_id)
);
