export const FIRST_NAME_MAX = 40;
export const NOTE_MAX = 200;
/** Plan 111 (D-112): choices under one dish, and the most rows a menu can hold (dishes and their choices). */
export const MAX_CHOICES = 30;
/** Plan 071: the delivery address fields. */
export const ADDRESS_STREET_MAX = 120;
export const ADDRESS_SUBURB_MAX = 60;
export const ADDRESS_POSTCODE_MAX = 10;
export const ADDRESS_NOTES_MAX = 200;
export const MAX_MENU_ITEMS = 50;
export const MAX_MENU_ROWS = MAX_MENU_ITEMS * (MAX_CHOICES + 1);
export const MAX_QTY = 99;
export const AUDIT_MAX = 4;
/** "N left" shows only when this many or fewer remain (D-027). */
export const LOW_STOCK = 5;
export const INBOX_MAX = 20;
/** Orders per GET /api/orders?tokens= request. */
export const TOKENS_MAX = 20;
export const POST_TEXT_MAX = 500;
/** Saved menu sets per seller (D-027). */
export const MAX_SETS = 5;
export const MAX_CHEFS = 20;
/** Largest uploaded image, after the client resized it (D-038). */
export const IMAGE_MAX_KB = 600;
/** Order details are kept this many weeks after the cooking date, then only totals (D-027 row 6). */
export const ORDER_DETAIL_WEEKS = 4;
export const ITEM_NAME_MAX = 80;
export const ITEM_DESCRIPTION_MAX = 300;
export const ITEM_SIZE_MAX = 40;
export const SET_NAME_MAX = 40;
export const CHEF_NAME_MAX = 40;
/** Saved pickup places per seller (D-061). */
export const MAX_PICKUP_PLACES = 5;
/** Dishes in the library ("Your dishes"). */
export const MAX_DISHES = 200;
/** Plan 067 (D-103): dish pictures per kitchen (about 30 MB at 100 KB each). */
export const MAX_DISH_PICTURES = 300;
/** Plan 067: a dish picture is 600 x 600 and about 100 KB; the server refuses more than this. */
export const DISH_PICTURE_MAX_KB = 200;
/** Plan 067: what the device aims for when it shrinks a dish picture. */
export const DISH_PICTURE_TARGET_KB = 100;
/** Plan 064: how many past menus keep their menu picture (the newest ones; older pictures are deleted). */
export const PAST_MENU_PICTURES_KEPT = 10;
export const PLACE_NAME_MAX = 80;
export const PLACE_DIRECTIONS_MAX = 200;
