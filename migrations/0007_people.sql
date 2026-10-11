-- 0007_people.sql: plan 033 (people and memberships; D-085, D-087, D-088, D-090).
-- One login per PERSON (`person:<id>`, with a display name); a person belongs to kitchens through
-- `memberships` (role owner or chef). The admin account is unchanged (D-087).
-- D-088: every seller and chef account, device, session, key, code and redemption is DELETED here
-- (they were demo logins). The admin account, its devices and sessions are copied across as they
-- are. Kitchens, menus, dishes, chefs, images and orders are not touched.

CREATE TABLE _keep_accounts AS SELECT * FROM accounts WHERE role = 'admin';
CREATE TABLE _keep_devices AS SELECT * FROM devices WHERE account_id IN (SELECT id FROM _keep_accounts);
CREATE TABLE _keep_sessions AS SELECT * FROM sessions WHERE account_id IN (SELECT id FROM _keep_accounts);

-- Children before parents, so no foreign key is ever broken.
DROP TABLE auth_key_redemptions;
DROP TABLE auth_keys;
DROP TABLE auth_codes;
DROP TABLE sessions;
DROP TABLE devices;
DROP TABLE accounts;

-- id: 'admin' or 'person:<random>'. A person's name is what the team list shows (D-090).
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  role                TEXT NOT NULL CHECK (role IN ('admin', 'person')),
  display_name        TEXT,
  password_salt       TEXT,
  password_hash       TEXT,
  password_iterations INTEGER,
  created_at          TEXT NOT NULL,
  CHECK ((role = 'person') = (display_name IS NOT NULL)),
  CHECK ((password_hash IS NULL) = (password_salt IS NULL) AND (password_hash IS NULL) = (password_iterations IS NULL))
) STRICT;

-- chef_id: the cook row this member is (a chef always; an owner who also cooks). No foreign key:
-- the app clears it when the cook is removed (SQLite cannot SET NULL on half of a composite key).
CREATE TABLE memberships (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  seller_id  TEXT NOT NULL REFERENCES sellers (id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'chef')),
  chef_id    TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, seller_id),
  CHECK (role <> 'chef' OR chef_id IS NOT NULL)
) STRICT;
CREATE INDEX memberships_by_seller ON memberships (seller_id);

CREATE TABLE devices (
  id                    TEXT PRIMARY KEY,
  account_id            TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  -- Passkey (public data only); NULL for a device that signs in by password.
  credential_id         TEXT UNIQUE,
  credential_public_key TEXT,
  credential_counter    INTEGER,
  credential_transports TEXT,
  created_at            TEXT NOT NULL,
  last_used_at          TEXT NOT NULL
) STRICT;
CREATE INDEX devices_by_account ON devices (account_id);

-- seller_id: the ACTIVE kitchen of the session (NULL for the admin).
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  device_id  TEXT REFERENCES devices (id) ON DELETE CASCADE,
  seller_id  TEXT REFERENCES sellers (id),
  via        TEXT CHECK (via IS NULL OR via IN ('admin-setup', 'key', 'code')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX sessions_one_per_device ON sessions (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX sessions_by_account ON sessions (account_id);
CREATE INDEX sessions_by_expiry ON sessions (expires_at);

-- An invite: admits ONE device within 24 hours (D-085) and adds a membership of `role` in
-- `seller_id` for the person who redeems it. key_hash is the SHA-256 of the normalised key.
CREATE TABLE auth_keys (
  key_hash     TEXT PRIMARY KEY,
  seller_id    TEXT NOT NULL REFERENCES sellers (id),
  role         TEXT NOT NULL CHECK (role IN ('owner', 'chef')),
  chef_id      TEXT,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  CHECK (role <> 'chef' OR chef_id IS NOT NULL)
) STRICT;
CREATE INDEX auth_keys_by_seller ON auth_keys (seller_id);

-- client_device_id: the random id the browser keeps (lockouts count on it), not devices.id.
CREATE TABLE auth_key_redemptions (
  key_hash         TEXT NOT NULL PRIMARY KEY REFERENCES auth_keys (key_hash) ON DELETE CASCADE,
  client_device_id TEXT NOT NULL,
  redeemed_at      TEXT NOT NULL
) STRICT;
-- One row per key (KEY_MAX_DEVICES = 1, D-085): the second insert fails, so a key is spent once
-- even under a race. Raising the limit means changing this key.

-- Add-device codes: 6 digits, 10 minutes, one use, per person. Only the hash is kept.
CREATE TABLE auth_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash  TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  seller_id  TEXT REFERENCES sellers (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1))
) STRICT;
CREATE INDEX auth_codes_by_hash ON auth_codes (code_hash);
CREATE INDEX auth_codes_by_account ON auth_codes (account_id);

INSERT INTO accounts (id, role, display_name, password_salt, password_hash, password_iterations, created_at)
  SELECT id, role, NULL, password_salt, password_hash, password_iterations, created_at FROM _keep_accounts;
INSERT INTO devices (id, account_id, name, credential_id, credential_public_key, credential_counter,
  credential_transports, created_at, last_used_at)
  SELECT id, account_id, name, credential_id, credential_public_key, credential_counter,
    credential_transports, created_at, last_used_at FROM _keep_devices;
INSERT INTO sessions (token_hash, account_id, device_id, seller_id, via, created_at, expires_at)
  SELECT token_hash, account_id, device_id, seller_id, via, created_at, expires_at FROM _keep_sessions;

DROP TABLE _keep_sessions;
DROP TABLE _keep_devices;
DROP TABLE _keep_accounts;
