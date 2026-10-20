-- 0033_client_order_id.sql: plan 114 (slow networks). Additive only: no table is dropped.
-- A customer's phone makes a random id when it starts an order and sends it with "Place order". If
-- the answer is lost and the phone sends the order again, the server finds the id and returns the
-- order it already made instead of making a second one. Old apps send none: the column stays NULL.
-- Run this migration BEFORE deploying the Worker that reads it.
ALTER TABLE orders ADD COLUMN client_order_id TEXT;
CREATE UNIQUE INDEX orders_client_order_id ON orders (seller_id, client_order_id) WHERE client_order_id IS NOT NULL;
