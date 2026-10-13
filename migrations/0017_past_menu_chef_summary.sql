-- 0017_past_menu_chef_summary.sql: plan 069 stage 3 (a finished menu keeps its per-chef figures).
-- JSON {rows: [...]} of the owner's view, written when the menu finishes; NULL for menus finished before.
ALTER TABLE past_weeks ADD COLUMN chef_summary TEXT;
