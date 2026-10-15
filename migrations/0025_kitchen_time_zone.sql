-- 0025_kitchen_time_zone.sql: plan 077 (D-101). The kitchen's IANA time zone, used by what has no device:
-- the hourly auto-finish and a new menu's default cut-off. Add-only; existing kitchens are in Adelaide.
ALTER TABLE kitchens ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Australia/Adelaide';
