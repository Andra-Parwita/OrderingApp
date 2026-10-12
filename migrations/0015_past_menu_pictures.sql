-- 0015_past_menu_pictures.sql: plan 064 (a finished menu keeps its picture).
-- The picture of each of the 10 newest past menus; older ones are set back to NULL by the finish job.
ALTER TABLE past_weeks ADD COLUMN picture_ref TEXT;
