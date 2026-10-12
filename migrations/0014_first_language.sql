-- 0014_first_language.sql: plan 060 (the language customers see first).
-- Used when languages = 'both': a customer who has not switched language yet sees this one.
ALTER TABLE kitchen_settings ADD COLUMN first_language TEXT NOT NULL DEFAULT 'en' CHECK (first_language IN ('en', 'id'));
