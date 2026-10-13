-- 0022_app_settings.sql: plan 046. The platform's one settings row (id 1): maintenance mode and the
-- announced update (the window and an optional note per language). Add-only; no row = all off.
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  maintenance INTEGER NOT NULL DEFAULT 0,
  notice_from TEXT,
  notice_until TEXT,
  notice_text_en TEXT,
  notice_text_id TEXT
);
