-- 0020_order_address_changed.sql: plan 071. A flag, set when the customer changes the delivery address
-- before the cut-off and cleared with the order's "changed" mark (the seller opens it or moves its
-- status). Only the flag is kept: the old address is never stored. Add-only; 0 = not changed.
ALTER TABLE orders ADD COLUMN address_changed INTEGER NOT NULL DEFAULT 0;
