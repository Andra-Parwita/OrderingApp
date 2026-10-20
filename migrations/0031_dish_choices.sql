-- 0031_dish_choices.sql: plan 111 (D-112). A dish can have choices: a choice is a `dishes` row (and, on a
-- menu, a `menu_items` row) whose group_id is the id of its parent; it has only a name and a limit, the rest
-- is copied from the parent. NULL means a normal dish. order_lines.note is the customer's (or the seller's)
-- note on one line. Add-only.
ALTER TABLE dishes ADD COLUMN group_id TEXT;
ALTER TABLE menu_items ADD COLUMN group_id TEXT;
ALTER TABLE order_lines ADD COLUMN note TEXT;
