-- 0032_menu_notices.sql: plan 112 (new-menu notices). Additive only: no table is dropped. Conventions
-- as in 0001: ISO-8601 TEXT timestamps, every seller-owned row carries seller_id.

-- One row per (kitchen, browser): a customer turned on "New menus from <kitchen>" in Settings
-- (D-113). It belongs to a kitchen and a device, never to a person, a phone number or an order, so
-- it outlives the order. `endpoint`, `p256dh` and `auth` are secrets of the customer's browser: they
-- are never logged and never returned by any route. `last_order_at` is the last time this phone
-- ordered from the kitchen (or turned the option on); the weekly cron drops rows older than 6 months.
CREATE TABLE menu_notice_subscriptions (
  seller_id     TEXT NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'id')),
  created_at    TEXT NOT NULL,
  last_order_at TEXT NOT NULL,
  PRIMARY KEY (seller_id, endpoint)
) STRICT;

-- Every notice the seller sent for a menu: when and how many phones it reached. A menu has one row in
-- `menus` per seller whose `id` changes with each new menu; the weekly cron drops the rows of any
-- menu that is no longer the seller's current one.
CREATE TABLE menu_notice_sends (
  seller_id TEXT NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
  menu_id   TEXT NOT NULL,
  sent_at   TEXT NOT NULL,
  reached   INTEGER NOT NULL CHECK (reached >= 0),
  PRIMARY KEY (seller_id, menu_id, sent_at)
) STRICT;
