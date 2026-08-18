-- =============================================================================
-- Migration: 025_respondio_ticket_automation.sql
-- Target DB: sims-staging-platform / production (MySQL 8.0)
-- Run as:    mysql -u user -p <database> < migrations/025_respondio_ticket_automation.sql
--
-- Requires:  024_contacts_directory.sql (tickets.contact_id references contacts)
--
-- Purpose:
--   Wires Respond.io -> SIMS ticket automation (driven by n8n) onto the Contacts
--   entity from migration 024.
--
--   `tickets.fid` / `tickets.oid` become NULLABLE and are widened to
--   VARCHAR(120). Both changes are corrections, not new requirements:
--
--     * Nullable, because an inbound Respond.io ticket may not resolve to an
--       outlet at all (no contact mapping) or may resolve only to a franchise
--       (a franchise-wide contact mapping pre-fills `fid` and leaves `oid`
--       unset, flagged `needs_outlet_match`).
--     * VARCHAR(120), because the original VARCHAR(4) / VARCHAR(2) cannot hold
--       real ids -- outlet ids are 5 digits. Under a non-strict sql_mode those
--       silently truncate; under strict mode they hard-fail. VARCHAR(120)
--       matches `merchants.external_id` / `merchant_outlets.external_id` so
--       joins stay same-type. `clickup_task_requests` carries the same two
--       undersized columns (values are copied verbatim from a ticket) and is
--       widened alongside.
--
--   AUDIT BEFORE RUNNING -- check for values already truncated by the old widths:
--     SELECT id, fid, oid FROM tickets WHERE CHAR_LENGTH(oid) = 2 OR CHAR_LENGTH(fid) = 4;
--   A 2-character oid is almost certainly a truncated 5-digit id and cannot be
--   recovered from the tickets row alone; reconcile against merchant_outlets.
--
--   The webhook ledger doubles as the idempotency ledger: n8n retries on failure
--   and may redeliver the same event, so `idempotency_key` carries a UNIQUE key
--   and the endpoint inserts first (status 'processing'). A duplicate insert
--   fails fast on ER_DUP_ENTRY and the call returns with zero side effects --
--   there is no read-then-write race to lose.
--
--   Secrets live in their own multi-row table rather than a column on
--   `respondio_settings` so rotation has a grace window: a new key can be issued
--   and handed to n8n while the previous one still verifies, instead of dropping
--   every in-flight event at the moment of rotation. Only the sha256 of the
--   secret is stored (see src/lib/respondio-secrets.ts for why sha256 and not
--   scrypt); `secret_prefix` + `secret_last4` exist purely to render the masked
--   form in the settings UI.
--
-- Column types:
--   The live `users.id` is a signed `BIGINT` (the schema.sql snapshot declares it
--   UNSIGNED, but the deployed databases drifted to signed). MySQL requires
--   foreign-key columns to match the referenced column's signedness exactly, so
--   every new id / FK column below is signed `BIGINT` (NOT UNSIGNED). See
--   migration 011 for the original note.
--
--   `tickets.id` is signed `BIGINT`, so `respondio_webhook_events.ticket_id` is
--   too. `contacts.id` (migration 024) is signed `BIGINT`, so
--   `tickets.contact_id` is too.
--
-- Rollback:
--   ALTER TABLE tickets
--     DROP FOREIGN KEY fk_tickets_contact,
--     DROP INDEX tickets_respondio_contact_idx,
--     DROP INDEX tickets_needs_outlet_idx,
--     DROP COLUMN needs_outlet_match,
--     DROP COLUMN contact_id,
--     DROP COLUMN respondio_contact_id,
--     DROP COLUMN source;
--   DROP TABLE IF EXISTS respondio_integration_secrets;
--   DROP TABLE IF EXISTS respondio_webhook_events;
--   DROP TABLE IF EXISTS respondio_settings;
--   -- Re-narrowing fid/oid is NOT part of the rollback: it would truncate data.
-- =============================================================================

ALTER TABLE tickets
  MODIFY COLUMN fid VARCHAR(120) DEFAULT NULL,
  MODIFY COLUMN oid VARCHAR(120) DEFAULT NULL,
  ADD COLUMN source ENUM('support_form', 'manual', 'respond_io')
    NOT NULL DEFAULT 'support_form' AFTER status,
  ADD COLUMN respondio_contact_id VARCHAR(64) DEFAULT NULL AFTER source,
  ADD COLUMN contact_id BIGINT DEFAULT NULL AFTER respondio_contact_id,
  ADD COLUMN needs_outlet_match TINYINT(1) NOT NULL DEFAULT 0 AFTER contact_id,
  ADD CONSTRAINT fk_tickets_contact
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  ADD INDEX tickets_respondio_contact_idx (respondio_contact_id, status),
  ADD INDEX tickets_needs_outlet_idx (needs_outlet_match, status);

-- Same undersized columns, copied verbatim from a ticket in
-- src/app/api/clickup-task-requests/route.ts.
ALTER TABLE clickup_task_requests
  MODIFY COLUMN fid VARCHAR(120) DEFAULT NULL,
  MODIFY COLUMN oid VARCHAR(120) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS respondio_settings (
  id INT NOT NULL PRIMARY KEY,
  routing_tag VARCHAR(120) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(255) DEFAULT NULL
);

-- Idempotent via the primary key; no subquery on the target table needed.
INSERT INTO respondio_settings (id, routing_tag)
VALUES (1, 'team:merchant_success')
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS respondio_webhook_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  respondio_contact_id VARCHAR(64) DEFAULT NULL,
  -- sha256 hex of (event_type | contact id | occurred_at | conversation id), or
  -- n8n's own event id when it supplies one.
  idempotency_key CHAR(64) NOT NULL,
  payload_raw JSON NOT NULL,
  secret_valid TINYINT(1) NOT NULL DEFAULT 0,
  processing_status ENUM(
    'processing', 'processed', 'ignored', 'rejected', 'noop', 'failed'
  ) NOT NULL DEFAULT 'processing',
  error_message TEXT DEFAULT NULL,
  result_summary VARCHAR(255) DEFAULT NULL,
  ticket_id BIGINT DEFAULT NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) DEFAULT NULL,
  UNIQUE KEY respondio_webhook_events_idem_uk (idempotency_key),
  INDEX respondio_webhook_events_received_idx (received_at),
  INDEX respondio_webhook_events_contact_idx (respondio_contact_id)
);

CREATE TABLE IF NOT EXISTS respondio_integration_secrets (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Safe to display and log; identifies which key an event authenticated with.
  key_id CHAR(12) NOT NULL,
  -- sha256 hex of the raw secret. The raw value is shown once, at creation.
  secret_hash CHAR(64) NOT NULL,
  secret_prefix VARCHAR(16) NOT NULL,
  secret_last4 CHAR(4) NOT NULL,
  created_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) DEFAULT NULL,
  revoked_by_user_id BIGINT DEFAULT NULL,
  last_used_at DATETIME(3) DEFAULT NULL,
  CONSTRAINT fk_respondio_secrets_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_respondio_secrets_revoked_by
    FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY respondio_integration_secrets_key_id_uk (key_id),
  INDEX respondio_integration_secrets_hash_idx (secret_hash),
  INDEX respondio_integration_secrets_active_idx (revoked_at, created_at)
);

-- Tickets auto-created from Respond.io have no triage yet, but
-- `tickets.issue_type` is NOT NULL. This gives the placeholder a matching option
-- in the ticket-edit category dropdown instead of rendering blank.
-- `ticket_categories` has no unique key on `name`, so ON DUPLICATE KEY cannot guard
-- this. FROM DUAL is required: MySQL rejects a WHERE clause on a SELECT with no FROM.
INSERT INTO ticket_categories (name, parent_id, sort_order)
SELECT 'Unclassified', NULL, 999 FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_categories AS tc
  WHERE tc.name = 'Unclassified' AND tc.parent_id IS NULL
);
