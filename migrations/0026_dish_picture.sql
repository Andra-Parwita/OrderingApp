-- 0026_dish_picture.sql: plan 067 (D-103). One optional picture per library dish, and the copy of it
-- on the menu item (a menu holds copies of its dishes, so customers read it from menu_items).
-- The value is the public image path (`/images/sellers/<id>/dishPicture-<hash>.jpg`) or, with no
-- bucket, a data URL. Add-only; NULL means no picture.
ALTER TABLE dishes ADD COLUMN picture_ref TEXT;
ALTER TABLE menu_items ADD COLUMN picture_ref TEXT;
