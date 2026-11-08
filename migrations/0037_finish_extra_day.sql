-- 0037_finish_extra_day.sql: plan 126 ("Keep the menu open 1 more day"). Additive only.
-- menus.finish_extra_day: 1 = the automatic finish waits one more day (midnight after the latest of the
-- cooking day and the delivery days, plus one day). 0 = as before. Existing menus get 0.
-- Run BEFORE deploying the Worker that writes it (with 0035 and 0036).
ALTER TABLE menus ADD COLUMN finish_extra_day INTEGER NOT NULL DEFAULT 0;
