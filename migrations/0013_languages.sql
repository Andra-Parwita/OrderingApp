-- 0013_languages.sql: plan 056 stage 1 (languages for customers).
-- 'both' = customers see English and Indonesian with a switch (today's behaviour); 'en' / 'id' = one language, no switch.
ALTER TABLE kitchen_settings ADD COLUMN languages TEXT NOT NULL DEFAULT 'both' CHECK (languages IN ('both', 'en', 'id'));
