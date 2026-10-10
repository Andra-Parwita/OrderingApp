-- 0005_push.sql: plan 004 stage 6 (web push). Additive only: no table is dropped. Conventions as in
-- 0001: ISO-8601 TEXT timestamps, every seller-owned row carries seller_id.

-- One row per (order, browser). A subscription belongs to an ORDER, never to a person or a phone
-- (D-059): the customer turns notifications on from that order's page, and the row goes when the
-- order does. `endpoint`, `p256dh` and `auth` are secrets of the customer's browser: they are never
-- logged and never returned by any route. Deleting the order (retention, D-044) cascades here; the
-- repository also deletes the rows when the order is cancelled and when its menu is finished.
CREATE TABLE push_subscriptions (
  seller_id  TEXT NOT NULL,
  order_id   TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (seller_id, order_id, endpoint),
  FOREIGN KEY (seller_id, order_id) REFERENCES orders (seller_id, id) ON DELETE CASCADE
) STRICT;
