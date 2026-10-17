-- 0027_private_orders.sql: plan 081. Private orders (Khusus): one-off orders the team makes for an event.
-- They reuse `orders` with kind 'private' and never get a past_week_id. event_date is the kitchen-local
-- date (YYYY-MM-DD), event_time the kitchen wall clock (HH:MM, D-101). order_lines.chef_id is copied from
-- the library dish. Add-only; every existing order stays 'menu'.
ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'menu' CHECK (kind IN ('menu', 'private'));
ALTER TABLE orders ADD COLUMN event_date TEXT;
ALTER TABLE orders ADD COLUMN event_time TEXT;
ALTER TABLE orders ADD COLUMN deposit_cents INTEGER CHECK (deposit_cents IS NULL OR deposit_cents >= 0);
ALTER TABLE order_lines ADD COLUMN chef_id TEXT;
CREATE INDEX orders_by_event ON orders (seller_id, kind, event_date);
