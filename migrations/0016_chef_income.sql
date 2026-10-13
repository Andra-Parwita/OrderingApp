-- 0016_chef_income.sql: plan 069 (per-chef portions and income).
-- Whether chefs may see their own income (on by default). Add-only; existing kitchens read 1.
ALTER TABLE kitchen_settings ADD COLUMN chefs_see_income INTEGER NOT NULL DEFAULT 1 CHECK (chefs_see_income IN (0, 1));
