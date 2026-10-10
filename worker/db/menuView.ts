// Small pieces shared by worker/db/seller.ts and worker/db/menus.ts (neither imports the other).
import type { MenuItem, SellerMenuItemView } from '../../shared/domain';
import type { Dish } from '../../shared/menusContract';

/** Portions taken per item by the seller's live (not cancelled) orders; add `GROUP BY l.item_id`. */
export const USED_SQL = `SELECT l.item_id AS item_id, SUM(l.qty) AS used
  FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
  WHERE o.seller_id = ? AND o.past_week_id IS NULL AND o.status <> 'cancelled'`;

/** The places the menu uses with the time that applies to it: this menu's override, else the usual one. */
export const MENU_PLACES_SQL = `SELECT p.id AS id, p.place AS place, p.directions_en AS directions_en,
    p.directions_id AS directions_id,
    COALESCE(m.window_start, p.window_start) AS window_start,
    COALESCE(m.window_end, p.window_end) AS window_end
  FROM menu_pickup_places m JOIN pickup_places p ON p.seller_id = m.seller_id AND p.id = m.place_id
  WHERE m.seller_id = ? ORDER BY m.position`;

/** A menu item as the seller sees it: what is left of the limit, and whether it is sold out. */
export function sellerView(item: MenuItem, used: Map<string, number>): SellerMenuItemView {
  const { soldOut: manual, ...rest } = item;
  const remaining =
    item.limit === undefined ? null : Math.max(0, item.limit - (used.get(item.id) ?? 0));
  return {
    ...rest,
    remaining,
    soldOut: manual === true || remaining === 0,
    ...(manual === true ? { manualSoldOut: true } : {}),
  };
}

/** The copy of a library dish that goes on a menu, with its own id. */
export function itemFromDish(dish: Dish, id: string): MenuItem {
  return {
    id,
    name: { ...dish.name },
    description: { ...dish.description },
    size: { ...dish.size },
    priceCents: dish.priceCents,
    ...(dish.limit !== undefined ? { limit: dish.limit } : {}),
    ...(dish.chefId !== undefined ? { chefId: dish.chefId } : {}),
  };
}
