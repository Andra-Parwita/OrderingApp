-- 0029_remember_me.sql: plan 087 ("Remember me", customers). Optional passkey for a customer: the
-- order list, first name, a stable per-kitchen code and a sealed address follow them to a new phone.
-- Separate from the sellers' accounts, sessions and passkeys on purpose (a customer can never reach
-- a seller route). No email, password or phone number. customer_order_links has no foreign key to
-- orders: a link outlives nothing but is swept when its order details are gone. Add-only.
CREATE TABLE customer_accounts (
  id           TEXT PRIMARY KEY,
  first_name   TEXT NOT NULL DEFAULT '',
  code_salt    TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  last_order_at TEXT
) STRICT;

CREATE TABLE customer_passkeys (
  credential_id TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES customer_accounts (id) ON DELETE CASCADE,
  public_key    TEXT NOT NULL,
  counter       INTEGER NOT NULL DEFAULT 0,
  transports    TEXT,
  prf           INTEGER NOT NULL DEFAULT 0 CHECK (prf IN (0, 1)),
  created_at    TEXT NOT NULL,
  last_used_at  TEXT NOT NULL
) STRICT;
CREATE INDEX customer_passkeys_by_account ON customer_passkeys (account_id);

-- Cookie `__Host-customer`; token stored as a hash. setup = 1: joined by a 6-digit code, no passkey yet.
CREATE TABLE customer_sessions (
  token_hash    TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES customer_accounts (id) ON DELETE CASCADE,
  credential_id TEXT,
  setup         INTEGER NOT NULL DEFAULT 0 CHECK (setup IN (0, 1)),
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
) STRICT;
CREATE INDEX customer_sessions_by_account ON customer_sessions (account_id);

-- account_id is the new account's id for 'register' (the row does not exist yet), so no foreign key.
CREATE TABLE customer_challenges (
  challenge        TEXT PRIMARY KEY,
  purpose          TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate', 'add')),
  session_hash     TEXT,
  client_device_id TEXT,
  account_id       TEXT,
  first_name       TEXT,
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL
) STRICT;

CREATE TABLE customer_phone_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash  TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES customer_accounts (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1))
) STRICT;
CREATE INDEX customer_phone_codes_by_hash ON customer_phone_codes (code_hash);

CREATE TABLE customer_order_links (
  account_id TEXT NOT NULL REFERENCES customer_accounts (id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  seller_id  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, token)
) STRICT;

-- Only plan 071 device codes adopted with proof; every other kitchen's code is derived (HMAC).
CREATE TABLE customer_kitchen_codes (
  account_id TEXT NOT NULL REFERENCES customer_accounts (id) ON DELETE CASCADE,
  seller_id  TEXT NOT NULL,
  code       TEXT NOT NULL,
  PRIMARY KEY (account_id, seller_id),
  UNIQUE (seller_id, code)
) STRICT;

-- The customer's saved address, sealed on their phone (AES-GCM, key from the passkey); one per passkey.
CREATE TABLE customer_sealed_addresses (
  credential_id TEXT PRIMARY KEY REFERENCES customer_passkeys (credential_id) ON DELETE CASCADE,
  account_id    TEXT NOT NULL REFERENCES customer_accounts (id) ON DELETE CASCADE,
  v             INTEGER NOT NULL,
  iv            TEXT NOT NULL,
  ct            TEXT NOT NULL CHECK (length(ct) <= 2048),
  updated_at    TEXT NOT NULL
) STRICT;
CREATE INDEX customer_sealed_by_account ON customer_sealed_addresses (account_id);

ALTER TABLE orders ADD COLUMN customer_confirmed INTEGER NOT NULL DEFAULT 0;
