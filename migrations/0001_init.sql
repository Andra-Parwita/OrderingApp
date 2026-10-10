-- 0001_init.sql: the whole Delave schema (stage 8.1a). Documented in docs/architecture/data-model.md;
-- keep the two in step. Conventions: ISO-8601 TEXT timestamps, money in integer cents, booleans as
-- 0/1, bilingual text as *_en / *_id columns, every seller-owned row carries seller_id.
-- Never stored (D-007): customer phone, address or email.

-- ---- Sellers and their kitchen ----

CREATE TABLE sellers (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE CHECK (slug = lower(slug) AND length(slug) > 0),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE kitchens (
  seller_id         TEXT PRIMARY KEY REFERENCES sellers (id),
  name              TEXT NOT NULL,
  tagline_en        TEXT NOT NULL DEFAULT '',
  tagline_id        TEXT NOT NULL DEFAULT '',
  banner_image_url  TEXT,
  -- '#rrggbb'. Written without a long GLOB: D1 refuses LIKE/GLOB patterns over 50 bytes.
  banner_background TEXT CHECK (banner_background IS NULL OR (length(banner_background) = 7 AND substr(banner_background, 1, 1) = '#' AND substr(banner_background, 2) NOT GLOB '*[^0-9a-fA-F]*')),
  image_alt_en      TEXT NOT NULL DEFAULT '',
  image_alt_id      TEXT NOT NULL DEFAULT ''
) STRICT;

CREATE TABLE kitchen_settings (
  seller_id       TEXT PRIMARY KEY REFERENCES sellers (id),
  whatsapp_number TEXT,
  post_greeting_en TEXT NOT NULL DEFAULT '',
  post_greeting_id TEXT NOT NULL DEFAULT '',
  post_closing_en  TEXT NOT NULL DEFAULT '',
  post_closing_id  TEXT NOT NULL DEFAULT '',
  ordering_open   INTEGER NOT NULL DEFAULT 1 CHECK (ordering_open IN (0, 1))
) STRICT;

CREATE TABLE kitchen_images (
  seller_id  TEXT NOT NULL REFERENCES sellers (id),
  slot       TEXT NOT NULL CHECK (slot IN ('railImage', 'railIcon', 'desktopBanner', 'phoneBanner', 'bannerBackgroundImage')),
  ref        TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (seller_id, slot)
) STRICT;

CREATE TABLE chefs (
  seller_id TEXT NOT NULL REFERENCES sellers (id),
  id        TEXT NOT NULL,
  name      TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (seller_id, id)
) STRICT;

-- ---- The current week: one row per seller, its pickup points, its menu ----

CREATE TABLE weeks (
  seller_id          TEXT PRIMARY KEY REFERENCES sellers (id),
  cooking_date       TEXT NOT NULL CHECK (cooking_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  cutoff_at          TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  delivery_available INTEGER NOT NULL CHECK (delivery_available IN (0, 1)),
  delivery_note_en   TEXT NOT NULL DEFAULT '',
  delivery_note_id   TEXT NOT NULL DEFAULT ''
) STRICT;

CREATE TABLE pickup_points (
  seller_id     TEXT NOT NULL REFERENCES sellers (id),
  id            TEXT NOT NULL,
  position      INTEGER NOT NULL,
  place         TEXT NOT NULL,
  directions_en TEXT NOT NULL DEFAULT '',
  directions_id TEXT NOT NULL DEFAULT '',
  window_start  TEXT NOT NULL,
  window_end    TEXT NOT NULL,
  PRIMARY KEY (seller_id, id)
) STRICT;

CREATE TABLE menu_items (
  seller_id      TEXT NOT NULL REFERENCES sellers (id),
  id             TEXT NOT NULL,
  position       INTEGER NOT NULL,
  name_en        TEXT NOT NULL,
  name_id        TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_id TEXT NOT NULL DEFAULT '',
  size_en        TEXT NOT NULL DEFAULT '',
  size_id        TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
  portion_limit  INTEGER CHECK (portion_limit IS NULL OR portion_limit >= 0),
  chef_id        TEXT,
  sold_out       INTEGER NOT NULL DEFAULT 0 CHECK (sold_out IN (0, 1)),
  PRIMARY KEY (seller_id, id),
  FOREIGN KEY (seller_id, chef_id) REFERENCES chefs (seller_id, id)
) STRICT;
CREATE INDEX menu_items_by_position ON menu_items (seller_id, position);

CREATE TABLE saved_sets (
  seller_id         TEXT NOT NULL REFERENCES sellers (id),
  id                TEXT NOT NULL,
  position          INTEGER NOT NULL,
  name              TEXT NOT NULL,
  banner_background TEXT,
  image_alt_en      TEXT NOT NULL DEFAULT '',
  image_alt_id      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (seller_id, id)
) STRICT;

CREATE TABLE saved_set_items (
  seller_id      TEXT NOT NULL,
  set_id         TEXT NOT NULL,
  position       INTEGER NOT NULL,
  name_en        TEXT NOT NULL,
  name_id        TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_id TEXT NOT NULL DEFAULT '',
  size_en        TEXT NOT NULL DEFAULT '',
  size_id        TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
  portion_limit  INTEGER CHECK (portion_limit IS NULL OR portion_limit >= 0),
  chef_id        TEXT,
  PRIMARY KEY (seller_id, set_id, position),
  FOREIGN KEY (seller_id, set_id) REFERENCES saved_sets (seller_id, id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id, chef_id) REFERENCES chefs (seller_id, id)
) STRICT;

CREATE TABLE saved_set_images (
  seller_id TEXT NOT NULL,
  set_id    TEXT NOT NULL,
  slot      TEXT NOT NULL CHECK (slot IN ('railImage', 'railIcon', 'desktopBanner', 'phoneBanner', 'bannerBackgroundImage')),
  ref       TEXT NOT NULL,
  PRIMARY KEY (seller_id, set_id, slot),
  FOREIGN KEY (seller_id, set_id) REFERENCES saved_sets (seller_id, id) ON DELETE CASCADE
) STRICT;

-- ---- Closed weeks ----

CREATE TABLE past_weeks (
  seller_id          TEXT NOT NULL REFERENCES sellers (id),
  id                 TEXT NOT NULL,
  cooking_date       TEXT NOT NULL CHECK (cooking_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  closed_at          TEXT NOT NULL,
  orders_count       INTEGER NOT NULL CHECK (orders_count >= 0),
  cancelled_count    INTEGER NOT NULL CHECK (cancelled_count >= 0),
  income_cents       INTEGER NOT NULL CHECK (income_cents >= 0),
  paid_cents         INTEGER NOT NULL CHECK (paid_cents >= 0),
  unpaid_cents       INTEGER NOT NULL CHECK (unpaid_cents >= 0),
  -- NULL while the order details are kept; set by retention when they are dropped (D-027 row 6).
  details_dropped_at TEXT,
  PRIMARY KEY (seller_id, id)
) STRICT;
CREATE INDEX past_weeks_by_closed ON past_weeks (seller_id, closed_at);
CREATE INDEX past_weeks_retention ON past_weeks (details_dropped_at, cooking_date);

CREATE TABLE past_week_items (
  seller_id    TEXT NOT NULL,
  past_week_id TEXT NOT NULL,
  position     INTEGER NOT NULL,
  item_id      TEXT NOT NULL,
  name_en      TEXT NOT NULL,
  name_id      TEXT NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (seller_id, past_week_id, position),
  FOREIGN KEY (seller_id, past_week_id) REFERENCES past_weeks (seller_id, id) ON DELETE CASCADE
) STRICT;

-- ---- Orders: live ones have past_week_id NULL; closing a week sets it (D-044) ----

CREATE TABLE orders (
  seller_id        TEXT NOT NULL REFERENCES sellers (id),
  id               TEXT NOT NULL,
  code             TEXT NOT NULL,
  token            TEXT NOT NULL UNIQUE,
  past_week_id     TEXT,
  first_name       TEXT NOT NULL,
  language         TEXT NOT NULL CHECK (language IN ('en', 'id')),
  fulfilment       TEXT NOT NULL CHECK (fulfilment IN ('pickup', 'delivery')),
  note             TEXT,
  status           TEXT NOT NULL CHECK (status IN ('ordered', 'confirmed', 'ready_for_pickup', 'out_for_delivery', 'collected', 'delivered', 'cancelled')),
  paid             INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
  locked           INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  wa_received      INTEGER NOT NULL DEFAULT 0 CHECK (wa_received IN (0, 1)),
  is_returning     INTEGER NOT NULL DEFAULT 0 CHECK (is_returning IN (0, 1)),
  changed          INTEGER NOT NULL DEFAULT 0 CHECK (changed IN (0, 1)),
  entered_by_role  TEXT CHECK (entered_by_role IN ('seller', 'chef')),
  entered_by_name  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (seller_id, id),
  UNIQUE (seller_id, code),
  FOREIGN KEY (seller_id, past_week_id) REFERENCES past_weeks (seller_id, id) ON DELETE CASCADE,
  CHECK ((entered_by_role IS NULL) = (entered_by_name IS NULL))
) STRICT;
CREATE INDEX orders_by_week ON orders (seller_id, past_week_id, created_at);
CREATE INDEX orders_by_status ON orders (seller_id, past_week_id, status);

-- Item snapshots (D-020): no foreign key to menu_items, a line keeps its own name and price.
CREATE TABLE order_lines (
  seller_id   TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  item_id     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  name_id     TEXT NOT NULL,
  size_en     TEXT NOT NULL DEFAULT '',
  size_id     TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  qty         INTEGER NOT NULL CHECK (qty >= 1),
  PRIMARY KEY (seller_id, order_id, position),
  FOREIGN KEY (seller_id, order_id) REFERENCES orders (seller_id, id) ON DELETE CASCADE
) STRICT;
CREATE INDEX order_lines_by_item ON order_lines (seller_id, item_id);

-- Last 4 changes (D-013). seq grows by 1 per order; the trigger keeps the newest 4.
CREATE TABLE order_audit (
  seller_id TEXT NOT NULL,
  order_id  TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  by_role   TEXT NOT NULL CHECK (by_role IN ('customer', 'seller', 'chef')),
  by_name   TEXT NOT NULL,
  what      TEXT NOT NULL CHECK (what IN ('created', 'edited', 'status', 'paid')),
  detail    TEXT,
  diff_json TEXT,
  at        TEXT NOT NULL,
  PRIMARY KEY (seller_id, order_id, seq),
  FOREIGN KEY (seller_id, order_id) REFERENCES orders (seller_id, id) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER order_audit_cap AFTER INSERT ON order_audit
BEGIN
  DELETE FROM order_audit
  WHERE seller_id = NEW.seller_id AND order_id = NEW.order_id AND seq <= NEW.seq - 4;
END;

-- Customer-visible messages, newest 20. Keys and data only, never translated text.
CREATE TABLE order_inbox (
  seller_id TEXT NOT NULL,
  order_id  TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  at        TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('status', 'nudge', 'message')),
  status    TEXT CHECK (status IS NULL OR status IN ('ordered', 'confirmed', 'ready_for_pickup', 'out_for_delivery', 'collected', 'delivered', 'cancelled')),
  text_key  TEXT,
  text      TEXT,
  minutes   INTEGER CHECK (minutes IS NULL OR minutes >= 0),
  PRIMARY KEY (seller_id, order_id, seq),
  FOREIGN KEY (seller_id, order_id) REFERENCES orders (seller_id, id) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER order_inbox_cap AFTER INSERT ON order_inbox
BEGIN
  DELETE FROM order_inbox
  WHERE seller_id = NEW.seller_id AND order_id = NEW.order_id AND seq <= NEW.seq - 20;
END;

-- What is left of an order once retention drops its details (D-044): its token and week date.
CREATE TABLE expired_orders (
  token        TEXT PRIMARY KEY,
  seller_id    TEXT NOT NULL REFERENCES sellers (id),
  cooking_date TEXT NOT NULL CHECK (cooking_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
) STRICT;
CREATE INDEX expired_orders_by_seller ON expired_orders (seller_id);

-- ---- Sign-in (D-011, D-013, D-027 row 1) ----

-- id: 'admin', 'seller:<sellerId>' or 'chef:<sellerId>:<chefId>'. Deleting a chef deletes the account
-- and, by cascade, its devices, sessions, keys and codes.
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  role                TEXT NOT NULL CHECK (role IN ('admin', 'seller', 'chef')),
  seller_id           TEXT REFERENCES sellers (id),
  chef_id             TEXT,
  password_salt       TEXT,
  password_hash       TEXT,
  password_iterations INTEGER,
  created_at          TEXT NOT NULL,
  FOREIGN KEY (seller_id, chef_id) REFERENCES chefs (seller_id, id) ON DELETE CASCADE,
  CHECK ((role = 'admin') = (seller_id IS NULL)),
  CHECK ((role = 'chef') = (chef_id IS NOT NULL)),
  CHECK ((password_hash IS NULL) = (password_salt IS NULL) AND (password_hash IS NULL) = (password_iterations IS NULL))
) STRICT;
CREATE INDEX accounts_by_seller ON accounts (seller_id);

CREATE TABLE devices (
  id                    TEXT PRIMARY KEY,
  account_id            TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  seller_id             TEXT REFERENCES sellers (id),
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
CREATE INDEX devices_by_seller ON devices (seller_id);

-- token_hash: SHA-256 of the session token; the token itself lives only in the cookie.
-- device_id is NULL for a setup session (the device is created when registration finishes).
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

-- key_hash: SHA-256 of the normalised key (invite or recovery); up to 3 redemptions.
CREATE TABLE auth_keys (
  key_hash   TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  seller_id  TEXT REFERENCES sellers (id),
  kind       TEXT NOT NULL CHECK (kind IN ('invite', 'recovery')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX auth_keys_by_account ON auth_keys (account_id);

-- client_device_id: the random id the browser keeps (lockouts count on it), not devices.id.
CREATE TABLE auth_key_redemptions (
  key_hash         TEXT NOT NULL REFERENCES auth_keys (key_hash) ON DELETE CASCADE,
  client_device_id TEXT NOT NULL,
  redeemed_at      TEXT NOT NULL,
  PRIMARY KEY (key_hash, client_device_id)
) STRICT;

-- Add-device codes: 6 digits, 10 minutes, one use. Only the hash is kept.
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

-- Lockouts: scope is 'device:<clientDeviceId>' or 'seller:<sellerId>'.
CREATE TABLE auth_attempts (
  scope        TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL CHECK (fails >= 0),
  locked_until TEXT,
  updated_at   TEXT NOT NULL
) STRICT;
CREATE INDEX auth_attempts_by_lock ON auth_attempts (locked_until);
