-- 0036_default_delivery_day.sql: plan 126 (the seller's default delivery day). Additive only.
-- menus.default_delivery_day: the delivery day customers see selected first (one of the menu's
-- delivery days). NULL = the cooking day. Run BEFORE deploying the Worker that writes it (with 0035).
ALTER TABLE menus ADD COLUMN default_delivery_day TEXT;
