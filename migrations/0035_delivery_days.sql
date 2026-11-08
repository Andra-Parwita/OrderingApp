-- 0035_delivery_days.sql: plan 126 (delivery on another day). Additive only: no table is dropped.
-- menus.extra_delivery_days: a JSON array of ISO dates (YYYY-MM-DD), the delivery days the seller
-- ticked: 2 days before to 1 day after the cooking day (the cooking day itself is in the list only
-- while it is ticked). NULL = only the cooking day (today's behaviour).
-- orders.handover_date: the day the customer chose (or the default). NULL = the cooking day. Named
-- "handover" so pickup can use it later. Lives and dies with the order row.
-- Run this migration BEFORE deploying the Worker that writes it.
ALTER TABLE menus ADD COLUMN extra_delivery_days TEXT;
ALTER TABLE orders ADD COLUMN handover_date TEXT;
