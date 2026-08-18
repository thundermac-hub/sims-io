-- =============================================================================
-- Migration: 024_contacts_directory.sql
-- Target DB: sims-staging-platform / production (MySQL 8.0)
-- Run as:    mysql -u user -p <database> < migrations/024_contacts_directory.sql
--
-- Purpose:
--   Introduces Contacts: a standalone merchant-side person, mapped to either a
--   specific outlet or an entire franchise, across any number of franchises.
--
--   Before this, contact-like details (name, phone, email, role) were re-typed
--   ad hoc inside each module -- a Sales lead's contact fields, a ticket's
--   merchant_name / phone_number -- with no shared identity behind them. One
--   franchise owner covering six outlets became six disconnected records.
--
--   `contact_outlets.outlet_id` is nullable, and NULL means "every outlet under
--   this franchise". That single nullable column is what lets one row express a
--   franchise-wide mapping instead of needing a row per outlet (which would also
--   go stale as the franchise opens new outlets).
--
--   `franchise_id` / `outlet_id` are VARCHAR business keys with NO foreign key,
--   matching how `merchant_outlets` already relates to `merchants` through
--   `merchant_external_id` rather than a real FK. An FK to `merchant_outlets` is
--   impossible anyway: its only unique index is the composite
--   (merchant_external_id, external_id), so `external_id` alone is not a valid
--   FK target.
--
--   The UNIQUE KEY on (contact_id, franchise_id, outlet_id) stops an exact
--   duplicate outlet mapping, but MySQL treats NULLs as distinct, so it does NOT
--   stop two franchise-wide rows for the same contact/franchise -- and it cannot
--   express the overlap rule at all (a franchise-wide mapping and a
--   specific-outlet mapping under the same franchise must not coexist). Both are
--   enforced in the application layer inside a transaction; see
--   src/lib/contact-mappings.ts.
--
--   `phone_normalized` is stored and indexed rather than computed at query time
--   because duplicate detection must be format-insensitive: "+60 16-220 7781"
--   and "+60162207781" are the same number, and an indexed equality lookup is
--   what makes the Respond.io phone match cheap on every inbound event.
--
-- Column types:
--   The live `users.id` is a signed `BIGINT` (the schema.sql snapshot declares it
--   UNSIGNED, but the deployed databases drifted to signed). MySQL requires
--   foreign-key columns to match the referenced column's signedness exactly, so
--   every new id / FK column below is signed `BIGINT` (NOT UNSIGNED). See
--   migration 011 for the original note.
--
--   `franchise_id` / `outlet_id` are VARCHAR(120) to match
--   `merchants.external_id` and `merchant_outlets.external_id`, NOT the
--   undersized `tickets.fid VARCHAR(4)` / `tickets.oid VARCHAR(2)` (widened in
--   migration 025).
--
-- Rollback:
--   DROP TABLE IF EXISTS contact_outlets;
--   DROP TABLE IF EXISTS contact_phone_numbers;
--   DROP TABLE IF EXISTS contacts;
-- =============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(255) DEFAULT NULL,
  source ENUM('staff', 'respond_io') NOT NULL DEFAULT 'staff',
  respondio_contact_id VARCHAR(64) DEFAULT NULL,
  -- Nullable: contacts auto-created by the Respond.io integration have no staff
  -- member present at creation time.
  created_by_user_id BIGINT DEFAULT NULL,
  deleted_at DATETIME(3) DEFAULT NULL,
  deleted_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_contacts_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_contacts_deleted_by
    FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY contacts_respondio_contact_uk (respondio_contact_id),
  INDEX contacts_live_email_idx (deleted_at, email),
  INDEX contacts_live_name_idx (deleted_at, name)
);

CREATE TABLE IF NOT EXISTS contact_phone_numbers (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contact_id BIGINT NOT NULL,
  phone VARCHAR(32) NOT NULL,
  -- Digits only, with a leading '+' preserved. Used for all matching.
  phone_normalized VARCHAR(32) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_contact_phone_numbers_contact
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  UNIQUE KEY contact_phone_numbers_contact_phone_uk (contact_id, phone_normalized),
  INDEX contact_phone_numbers_normalized_idx (phone_normalized)
);

CREATE TABLE IF NOT EXISTS contact_outlets (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contact_id BIGINT NOT NULL,
  -- merchants.external_id / merchants.fid
  franchise_id VARCHAR(120) NOT NULL,
  -- merchant_outlets.external_id; NULL means "every outlet under this franchise"
  outlet_id VARCHAR(120) DEFAULT NULL,
  created_by_user_id BIGINT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_contact_outlets_contact
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_outlets_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY contact_outlets_uk (contact_id, franchise_id, outlet_id),
  INDEX contact_outlets_scope_idx (franchise_id, outlet_id)
);
