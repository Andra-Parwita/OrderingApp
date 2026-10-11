-- 0010_helper.sql: plan 028 (a third membership role, `helper`).
-- SQLite cannot alter a CHECK, so `memberships` and `auth_keys` are rebuilt with
-- role IN ('owner', 'chef', 'helper'); `auth_key_redemptions` (which points at auth_keys) is rebuilt
-- with them. Every row is copied unchanged. A helper has chef_id NULL (the chef CHECK stays).
-- Same approach as 0007: copy aside, drop children before parents, create, copy back.

CREATE TABLE _keep_memberships AS SELECT * FROM memberships;
CREATE TABLE _keep_auth_keys AS SELECT * FROM auth_keys;
CREATE TABLE _keep_redemptions AS SELECT * FROM auth_key_redemptions;

DROP TABLE auth_key_redemptions;
DROP TABLE auth_keys;
DROP TABLE memberships;

-- chef_id: the cook row this member is (a chef always; an owner who also cooks; never a helper).
-- No foreign key: the app clears it when the cook is removed.
CREATE TABLE memberships (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  seller_id  TEXT NOT NULL REFERENCES sellers (id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'chef', 'helper')),
  chef_id    TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, seller_id),
  CHECK (role <> 'chef' OR chef_id IS NOT NULL)
) STRICT;
CREATE INDEX memberships_by_seller ON memberships (seller_id);

CREATE TABLE auth_keys (
  key_hash     TEXT PRIMARY KEY,
  seller_id    TEXT NOT NULL REFERENCES sellers (id),
  role         TEXT NOT NULL CHECK (role IN ('owner', 'chef', 'helper')),
  chef_id      TEXT,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  CHECK (role <> 'chef' OR chef_id IS NOT NULL)
) STRICT;
CREATE INDEX auth_keys_by_seller ON auth_keys (seller_id);

CREATE TABLE auth_key_redemptions (
  key_hash         TEXT NOT NULL PRIMARY KEY REFERENCES auth_keys (key_hash) ON DELETE CASCADE,
  client_device_id TEXT NOT NULL,
  redeemed_at      TEXT NOT NULL
) STRICT;

INSERT INTO memberships (account_id, seller_id, role, chef_id, created_at)
  SELECT account_id, seller_id, role, chef_id, created_at FROM _keep_memberships;
INSERT INTO auth_keys (key_hash, seller_id, role, chef_id, display_name, created_at, expires_at)
  SELECT key_hash, seller_id, role, chef_id, display_name, created_at, expires_at FROM _keep_auth_keys;
INSERT INTO auth_key_redemptions (key_hash, client_device_id, redeemed_at)
  SELECT key_hash, client_device_id, redeemed_at FROM _keep_redemptions;

DROP TABLE _keep_redemptions;
DROP TABLE _keep_auth_keys;
DROP TABLE _keep_memberships;
