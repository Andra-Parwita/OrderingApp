-- 0008_made_counts.sql: plan 035 stage 4 (shared "made" counts on the Cook screen).
-- How many of each dish are cooked, per kitchen and menu (the cooking day), so every phone and
-- tablet shows the same numbers. Written as increments, so two taps at once both count. The rows
-- belong to the menu: a write for a new menu deletes the rows of the old one (as message_log does).
-- "Packed" is already on the server (orders.packed, 0004).
CREATE TABLE made_counts (
  seller_id TEXT NOT NULL REFERENCES sellers (id),
  menu_id   TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  made      INTEGER NOT NULL CHECK (made BETWEEN 0 AND 9999),
  PRIMARY KEY (seller_id, menu_id, item_id)
) STRICT;
