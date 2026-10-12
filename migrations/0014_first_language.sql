-- 0014_first_language.sql: plan 060 (the language customers see first).
-- Used when languages = 'both': NULL = the seller has not chosen, so a customer keeps their phone's language.
ALTER TABLE kitchen_settings ADD COLUMN first_language TEXT CHECK (first_language IS NULL OR first_language IN ('en', 'id'));
