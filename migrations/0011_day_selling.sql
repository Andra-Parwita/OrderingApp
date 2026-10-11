-- 0011_day_selling.sql: plan 029 stages 1-2 (selling on the day, D-083).
-- Stage 1: each dish and each menu item says whether it can be pre-ordered (`preorder`, on by
-- default; its portion limit stays the pre-order limit) and how many portions are sold at the stall
-- on the day (`day_stock`, NULL = not sold on the day). Existing rows read preorder = 1, day_stock
-- NULL. Pre-orders never take from `day_stock`. The library dish carries both so saved sets keep them.
ALTER TABLE dishes ADD COLUMN preorder INTEGER NOT NULL DEFAULT 1 CHECK (preorder IN (0, 1));
ALTER TABLE dishes ADD COLUMN day_stock INTEGER CHECK (day_stock IS NULL OR day_stock BETWEEN 0 AND 9999);
ALTER TABLE menu_items ADD COLUMN preorder INTEGER NOT NULL DEFAULT 1 CHECK (preorder IN (0, 1));
ALTER TABLE menu_items ADD COLUMN day_stock INTEGER CHECK (day_stock IS NULL OR day_stock BETWEEN 0 AND 9999);

-- Stage 2: the sales log. `change` is negative for a sale (-n) and the difference for "Set count";
-- `stock_after` is the stock once the row was written. A row is written in the same batch as the
-- stock change, so the log always adds up. `kind` is 'sale' or 'count'; `by_name` is the person's
-- name then (accounts can go). `undone` marks a sale that was undone (stage 4). No foreign key to
-- menu_items: the log outlives the menu (kept 10 weeks per kitchen, by the weekly clean-up).
CREATE TABLE day_sales (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT NOT NULL REFERENCES sellers (id),
  menu_id     TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('sale', 'count', 'undo')),
  change      INTEGER NOT NULL,
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  by_account  TEXT,
  by_name     TEXT NOT NULL,
  at          TEXT NOT NULL,
  undone      INTEGER NOT NULL DEFAULT 0 CHECK (undone IN (0, 1)),
  undoes      TEXT
) STRICT;
-- An 'undo' row reverses one sale: it carries that sale's id in `undoes` (only once, so two undos
-- at once cannot both return the portions) and the sale is marked `undone`.
CREATE UNIQUE INDEX day_sales_one_undo ON day_sales (undoes) WHERE undoes IS NOT NULL;
CREATE INDEX day_sales_by_seller ON day_sales (seller_id, at);
