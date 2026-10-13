-- 0019_order_customer_code.sql: plan 071 stage 4 (D-099). The anonymous customer code the customer's
-- phone sends with an order (random, per kitchen, no name/phone in it). Read only by the kitchen's
-- team, so the seller's device can link repeat orders to a saved customer. Add-only; NULL = none.
ALTER TABLE orders ADD COLUMN customer_code TEXT;
