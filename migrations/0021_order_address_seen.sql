-- 0021_order_address_seen.sql: plan 071. The team's one-tap "Got it" on a customer's changed delivery
-- address. A new change (0020 address_changed = 1) resets it to 0. Only flags: no address is kept.
-- Add-only; 0 = not yet seen.
ALTER TABLE orders ADD COLUMN address_seen INTEGER NOT NULL DEFAULT 0;
