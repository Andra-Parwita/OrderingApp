-- 0006_demo.sql: plan 013 (demo kitchen, D-076). Additive only.
-- A demo kitchen may add and clear sample orders from the seller app (the admin switches it on).
ALTER TABLE sellers ADD COLUMN demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1));
-- 1 for an order made by the sample generator; "Clear samples" deletes only these.
ALTER TABLE orders ADD COLUMN sample INTEGER NOT NULL DEFAULT 0 CHECK (sample IN (0, 1));
