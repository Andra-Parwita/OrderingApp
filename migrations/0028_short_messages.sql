-- 0028_short_messages.sql: plan 086 (D-106). The admin's short messages: a plain note in EN and ID,
-- aimed at everyone / sellers / customers and at all kitchens (seller_ids NULL) or a JSON list of
-- seller ids. Shown to new visitors until expires_at (or stopped_at). Add-only.
CREATE TABLE short_messages (
  id TEXT PRIMARY KEY,
  text_en TEXT NOT NULL,
  text_id TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('everyone', 'sellers', 'customers')),
  seller_ids TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  stopped_at TEXT
);
CREATE INDEX short_messages_created ON short_messages (created_at);
