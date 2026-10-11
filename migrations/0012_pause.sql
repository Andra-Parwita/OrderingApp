-- 0012_pause.sql: plan 032 stage 3 (pausing a kitchen, D-086).
-- NULL = open. 'customers' = customers cannot see or order, staff work as normal.
-- 'full' = also nobody of the kitchen can sign in (their sessions are deleted when it is set).
ALTER TABLE sellers ADD COLUMN paused TEXT CHECK (paused IS NULL OR paused IN ('full', 'customers'));
