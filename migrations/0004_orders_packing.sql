-- 0004_orders_packing.sql: plan 001 stage 4 (orders, packing, messages). Additive only: no table is
-- dropped. Conventions as in 0001: ISO-8601 TEXT timestamps, booleans as 0/1, every seller-owned
-- row carries seller_id.

-- ---- Orders ----
-- Packing (D-066) is kept apart from the status: setting `packed` or a tick never changes the
-- status, never bumps updated_at, and the customer's views never carry it.
ALTER TABLE orders ADD COLUMN packed INTEGER NOT NULL DEFAULT 0 CHECK (packed IN (0, 1));
-- Who confirmed the hand-over, and when. NULL until someone does. Both are set together.
ALTER TABLE orders ADD COLUMN collected_at TEXT;
ALTER TABLE orders ADD COLUMN collected_by TEXT CHECK (collected_by IS NULL OR collected_by IN ('customer', 'seller'));
-- The pickup place (a pickup_places id) a pickup order was placed for. NULL for delivery orders and
-- for orders placed before places were chosen; a NULL pickup order counts as the menu's first
-- place. No foreign key: a place may be deleted while orders still name it (D-062).
ALTER TABLE orders ADD COLUMN pickup_place_id TEXT;

-- Per-item packing ticks live on the order line, one flag per line. They survive an edit of the
-- order's lines because the repository keeps a line's flag when only its quantity changes.
ALTER TABLE order_lines ADD COLUMN ticked INTEGER NOT NULL DEFAULT 0 CHECK (ticked IN (0, 1));

-- ---- Message log ----
-- What the seller sent, per group, for the menu that is current. `group_key` is 'place:<place id>',
-- 'delivery' or 'order:<order code>'. Texts are set only for a custom message. The log belongs to
-- one menu: the repository drops rows of any other menu when it writes a new one. It holds no
-- customer data (a code is not a phone number or an address, D-059).
CREATE TABLE message_log (
  seller_id  TEXT NOT NULL REFERENCES sellers (id),
  id         TEXT NOT NULL,
  menu_id    TEXT NOT NULL,
  group_key  TEXT NOT NULL CHECK (group_key = 'delivery' OR group_key GLOB 'place:?*' OR group_key GLOB 'order:?*'),
  type       TEXT NOT NULL CHECK (type IN ('ready_in', 'ready_now', 'custom', 'out_for_delivery', 'arriving_soon', 'delivered')),
  minutes    INTEGER CHECK (minutes IS NULL OR minutes >= 1),
  text_en    TEXT,
  text_id    TEXT,
  at         TEXT NOT NULL,
  sent_count INTEGER NOT NULL CHECK (sent_count >= 0),
  PRIMARY KEY (seller_id, id)
) STRICT;
CREATE INDEX message_log_by_group ON message_log (seller_id, menu_id, group_key, at);
