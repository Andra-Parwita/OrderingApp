-- 0038_keep_open_default.sql: plan 131 (new menus stay open 1 more day by default). Additive only.
-- kitchen_settings.keep_open_default: 1 = a NEW menu starts with "Keep the menu open 1 more day" on
-- (menus.finish_extra_day = 1). 0 = off. Existing kitchens get 1; existing menus are not changed.
-- Run BEFORE deploying the Worker that reads it.
ALTER TABLE kitchen_settings ADD COLUMN keep_open_default INTEGER NOT NULL DEFAULT 1 CHECK (keep_open_default IN (0, 1));
