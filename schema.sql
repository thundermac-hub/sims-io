-- Schema snapshot (current)

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar_url TEXT DEFAULT NULL,
  department VARCHAR(80) NOT NULL,
  role VARCHAR(40) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  external_id VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  fid VARCHAR(120) DEFAULT NULL,
  outlet_count INT NOT NULL DEFAULT 0,
  status VARCHAR(60) DEFAULT NULL,
  raw_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_import_runs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  status ENUM('running', 'success', 'failed') NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  records_imported INT NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS merchant_outlets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  external_id VARCHAR(120) NOT NULL,
  merchant_external_id VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(60) DEFAULT NULL,
  raw_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_merchant_outlet (merchant_external_id, external_id),
  INDEX idx_merchant_outlets_merchant_external_id (merchant_external_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  contact_number VARCHAR(32) NOT NULL UNIQUE,
  contact_name VARCHAR(120) DEFAULT NULL,
  last_message_at TIMESTAMP NULL DEFAULT NULL,
  last_message_preview TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  direction ENUM('inbound', 'outbound') NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(40) DEFAULT NULL,
  provider_message_id VARCHAR(64) DEFAULT NULL,
  sender_number VARCHAR(32) DEFAULT NULL,
  receiver_number VARCHAR(32) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_messages_conversation (conversation_id),
  INDEX idx_whatsapp_messages_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS ticket_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  parent_id CHAR(36) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ticket_categories_parent (parent_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) DEFAULT NULL,
  channel ENUM('whatsapp', 'email', 'form') NOT NULL DEFAULT 'whatsapp',
  customer_name VARCHAR(120) DEFAULT NULL,
  customer_phone VARCHAR(32) DEFAULT NULL,
  franchise_name VARCHAR(255) DEFAULT NULL,
  outlet_name VARCHAR(255) DEFAULT NULL,
  fid VARCHAR(120) DEFAULT NULL,
  oid VARCHAR(120) DEFAULT NULL,
  ms_agent_id CHAR(36) DEFAULT NULL,
  status ENUM('new', 'open', 'pending_merchant', 'pending_internal', 'resolved', 'closed') NOT NULL DEFAULT 'new',
  category VARCHAR(120) DEFAULT NULL,
  subcategory_1 VARCHAR(120) DEFAULT NULL,
  subcategory_2 VARCHAR(120) DEFAULT NULL,
  issue_description TEXT DEFAULT NULL,
  internal_notes TEXT DEFAULT NULL,
  csat_link TEXT DEFAULT NULL,
  csat_score TINYINT DEFAULT NULL,
  csat_response TEXT DEFAULT NULL,
  last_message_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tickets_conversation (conversation_id),
  INDEX idx_tickets_status (status),
  INDEX idx_tickets_fid (fid),
  INDEX idx_tickets_oid (oid),
  INDEX idx_tickets_last_message_at (last_message_at)
);

INSERT INTO users (id, name, email, department, role, status, password_hash)
VALUES (
  '8a868a44-5ae1-4b43-9f42-3deaf7280f3f',
  'Super Admin',
  'admin@sims.local',
  'Merchant Success',
  'Super Admin',
  'active',
  'e910ed24ba65bf62f83ade706cd2d378:d7f8f1e86d39ac661c5bba0ef1c3337c685f556fe72ecdec912eb3ba799472dfe35dfa43586460bc60e9a0c4d0ed6401f0a5e05556b1c0f2d6b71f6b2e12d430'
)
ON DUPLICATE KEY UPDATE id = id;
