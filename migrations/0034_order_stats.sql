-- 0034_order_stats.sql: plan 121 part B (anonymous order statistics). Additive only: no table is dropped.
-- Four facts the customer's phone sends with an order, for counts in the admin app only: where the app
-- was opened (app | browser | inapp), the phone's system (ios | android | other), whether notifications
-- are on (0/1) and whether Remember me is on (0/1). No names, ids or free text. Old apps send nothing:
-- the columns stay NULL ("unknown"). They live and die with the order row (existing retention rules).
-- Run this migration BEFORE deploying the Worker that writes it.
ALTER TABLE orders ADD COLUMN src_place TEXT;
ALTER TABLE orders ADD COLUMN src_os TEXT;
ALTER TABLE orders ADD COLUMN src_push INTEGER;
ALTER TABLE orders ADD COLUMN src_remember INTEGER;
