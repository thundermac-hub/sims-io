-- =============================================================================
-- Migration: 026_object_key_lookup_indexes.sql
-- Target DB: sims-platform (MySQL 8.x)
--
-- Purpose:
--   The uploads/view route authorizes shared reads by checking that a storage
--   key is referenced by a record the caller can already see. Those checks are
--   exact-match lookups against attachment columns; these prefix indexes make
--   them index seeks instead of table scans.
--
-- Notes:
--   MySQL DDL auto-commits, so take a database backup immediately before running.
--   Idempotent — guarded by information_schema checks.
-- =============================================================================

DROP PROCEDURE IF EXISTS _add_object_key_lookup_indexes;

DELIMITER $$

CREATE PROCEDURE _add_object_key_lookup_indexes()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tickets'
      AND INDEX_NAME = 'tickets_attachment_url_idx'
  ) THEN
    ALTER TABLE tickets
      ADD INDEX tickets_attachment_url_idx (attachment_url(191)),
      ADD INDEX tickets_attachment_url_2_idx (attachment_url_2(191)),
      ADD INDEX tickets_attachment_url_3_idx (attachment_url_3(191));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clickup_task_requests'
      AND INDEX_NAME = 'clickup_task_requests_attachment_url_idx'
  ) THEN
    ALTER TABLE clickup_task_requests
      ADD INDEX clickup_task_requests_attachment_url_idx (attachment_url(191)),
      ADD INDEX clickup_task_requests_attachment_url_2_idx (attachment_url_2(191)),
      ADD INDEX clickup_task_requests_attachment_url_3_idx (attachment_url_3(191));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clickup_task_request_attachments'
      AND INDEX_NAME = 'clickup_task_request_attachments_storage_key_idx'
  ) THEN
    ALTER TABLE clickup_task_request_attachments
      ADD INDEX clickup_task_request_attachments_storage_key_idx (storage_key(191));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'onboarding_appointment_attachments'
      AND INDEX_NAME = 'onboarding_appointment_attachments_storage_key_idx'
  ) THEN
    ALTER TABLE onboarding_appointment_attachments
      ADD INDEX onboarding_appointment_attachments_storage_key_idx (storage_key(191));
  END IF;
END$$

DELIMITER ;

CALL _add_object_key_lookup_indexes();
DROP PROCEDURE IF EXISTS _add_object_key_lookup_indexes;
