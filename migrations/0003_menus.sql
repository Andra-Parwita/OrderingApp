-- 0003_menus.sql: plan 001 stage 3 (menus and dishes). There is no production data, so the tables
-- below are reshaped, not migrated: `weeks` becomes `menus`, `pickup_points` becomes the seller's
-- `pickup_places`, saved sets point at library dishes, and kitchen_settings gains the theme and the
-- menu defaults. A local database made by 0001 loses its week, pickup, set and settings rows here:
-- reset it (delete .wrangler/state, then db:migrate:local and db:seed:local).
-- Conventions as in 0001: ISO-8601 TEXT timestamps, money in integer cents, booleans as 0/1,
-- bilingual text as *_en / *_id columns, every seller-owned row carries seller_id.

-- ---- Retired shapes ----

DROP TABLE saved_set_items;
DROP TABLE pickup_points;
DROP TABLE weeks;
DROP TABLE kitchen_settings;

-- ---- Kitchen settings: + theme (D-064) and menu defaults; "taking orders" moved to the menu ----

CREATE TABLE kitchen_settings (
  seller_id                   TEXT PRIMARY KEY REFERENCES sellers (id),
  whatsapp_number             TEXT,
  post_greeting_en            TEXT NOT NULL DEFAULT '',
  post_greeting_id            TEXT NOT NULL DEFAULT '',
  post_closing_en             TEXT NOT NULL DEFAULT '',
  post_closing_id             TEXT NOT NULL DEFAULT '',
  theme                       TEXT NOT NULL DEFAULT 'onde' CHECK (theme IN ('onde', 'bali', 'sumatra', 'sunda', 'jawa')),
  -- A new menu's cut-off: this many days before the cooking day, at this local time.
  default_cutoff_days         INTEGER NOT NULL DEFAULT 1 CHECK (default_cutoff_days BETWEEN 0 AND 14),
  default_cutoff_time         TEXT NOT NULL DEFAULT '21:00' CHECK (default_cutoff_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  default_delivery            INTEGER NOT NULL DEFAULT 0 CHECK (default_delivery IN (0, 1)),
  default_delivery_note_en    TEXT NOT NULL DEFAULT '',
  default_delivery_note_id    TEXT NOT NULL DEFAULT ''
) STRICT;

-- ---- The menu: one row per seller, one menu at a time (D-063) ----
-- state: not_published -> live -> finished. A finished menu stays here until the seller makes the
-- next one; finishing also archives its orders into past_weeks under this menu's id.

CREATE TABLE menus (
  seller_id          TEXT PRIMARY KEY REFERENCES sellers (id),
  id                 TEXT NOT NULL,
  state              TEXT NOT NULL CHECK (state IN ('not_published', 'live', 'finished')),
  cooking_date       TEXT NOT NULL CHECK (cooking_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  cutoff_at          TEXT NOT NULL,
  delivery_available INTEGER NOT NULL CHECK (delivery_available IN (0, 1)),
  delivery_note_en   TEXT NOT NULL DEFAULT '',
  delivery_note_id   TEXT NOT NULL DEFAULT '',
  -- One 3:2 picture per menu (D-060); NULL until the seller adds one.
  picture_ref        TEXT,
  -- The furthest wizard step reached (0 Dishes, 1 Details, 2 Check, 3 Publish & share).
  wizard_step        INTEGER NOT NULL DEFAULT 0 CHECK (wizard_step BETWEEN 0 AND 3),
  taking_orders      INTEGER NOT NULL DEFAULT 1 CHECK (taking_orders IN (0, 1)),
  published_at       TEXT,
  finished_at        TEXT
) STRICT;

-- Up to 5 saved places per seller (D-061; the cap is checked by the repository).
CREATE TABLE pickup_places (
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

-- The places the menu uses, in order, each with an optional time for this menu only.
CREATE TABLE menu_pickup_places (
  seller_id    TEXT NOT NULL REFERENCES sellers (id),
  place_id     TEXT NOT NULL,
  position     INTEGER NOT NULL,
  window_start TEXT,
  window_end   TEXT,
  PRIMARY KEY (seller_id, place_id),
  FOREIGN KEY (seller_id, place_id) REFERENCES pickup_places (seller_id, id) ON DELETE CASCADE,
  CHECK ((window_start IS NULL) = (window_end IS NULL))
) STRICT;

-- ---- Dishes ----

-- "Your dishes": every dish the seller has saved, kept apart from menus and orders. A NULL chef is
-- the whole kitchen.
CREATE TABLE dishes (
  seller_id      TEXT NOT NULL REFERENCES sellers (id),
  id             TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  name_id        TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_id TEXT NOT NULL DEFAULT '',
  size_en        TEXT NOT NULL DEFAULT '',
  size_id        TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
  portion_limit  INTEGER CHECK (portion_limit IS NULL OR portion_limit >= 0),
  chef_id        TEXT,
  last_used_at   TEXT,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (seller_id, id),
  FOREIGN KEY (seller_id, chef_id) REFERENCES chefs (seller_id, id)
) STRICT;
CREATE INDEX dishes_by_name ON dishes (seller_id, name_en);

-- A menu dish is a row of menu_items: a copy with its own price, limit, chef and sold out. dish_id
-- says which library dish it came from; it has no foreign key, so deleting a dish never touches a
-- menu (D-062). Order lines keep their own snapshot as before (D-020).
ALTER TABLE menu_items ADD COLUMN dish_id TEXT;

-- ---- Saved sets: a name and a list of library dishes ----

ALTER TABLE saved_sets ADD COLUMN times_used INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0);

CREATE TABLE saved_set_dishes (
  seller_id TEXT NOT NULL,
  set_id    TEXT NOT NULL,
  position  INTEGER NOT NULL,
  dish_id   TEXT NOT NULL,
  PRIMARY KEY (seller_id, set_id, position),
  UNIQUE (seller_id, set_id, dish_id),
  FOREIGN KEY (seller_id, set_id) REFERENCES saved_sets (seller_id, id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id, dish_id) REFERENCES dishes (seller_id, id) ON DELETE CASCADE
) STRICT;
