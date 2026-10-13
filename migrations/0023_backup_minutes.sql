-- 0023_backup_minutes.sql: plan 074. How often the apps check for news while their live connection
-- is down (minutes), one for customers and one for sellers. Add-only; defaults 5 and 5 (bounds 1-30
-- are checked by the Worker).
ALTER TABLE app_settings ADD COLUMN backup_customer_min INTEGER NOT NULL DEFAULT 5;
ALTER TABLE app_settings ADD COLUMN backup_seller_min INTEGER NOT NULL DEFAULT 5;
