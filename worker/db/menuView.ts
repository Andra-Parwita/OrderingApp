// Small pieces shared by worker/db/seller.ts and worker/db/menus.ts (neither imports the other).
import type { MenuItem, SellerMenuItemView } from '../../shared/domain';
import type { Dish } from '../../shared/menusContract';
import { LIVE_MENU } from './orders';

/** Portions taken per item by the seller's live (not cancelled) orders; add `GROUP BY l.item_id`. */
export const USED_SQL = `SELECT l.item_id AS item_id, SUM(l.qty) AS used
  FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
  WHERE o.seller_id = ? AND ${LIVE_MENU} AND o.status <> 'cancelled'`;

/** The places the menu uses with the time that applies to it: this menu's override, else the usual one. */
export const MENU_PLACES_SQL = `SELECT p.id AS id, p.place AS place, p.directions_en AS directions_en,
    p.directions_id AS directions_id, p.address AS address, p.lat AS lat, p.lng AS lng,
    COALESCE(m.window_start, p.window_start) AS window_start,
    COALESCE(m.window_end, p.window_end) AS window_end
  FROM menu_pickup_places m JOIN pickup_places p ON p.seller_id = m.seller_id AND p.id = m.place_id
  WHERE m.seller_id = ? ORDER BY m.position`;

/** The kitchen's pickup places, in their order (plan 113: shared with the backup). */
export const PICKUP_PLACES_SQL =
  'SELECT * FROM pickup_places WHERE seller_id = ? ORDER BY position';

/** The places the current menu uses, with its own times (plan 113: shared with the backup). */
export const MENU_USES_SQL =
  'SELECT place_id, window_start, window_end FROM menu_pickup_places WHERE seller_id = ? ORDER BY position';

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

/**
 * The seller's view of a whole menu (plan 111): a choice is sold out when its own flag or limit says
 * so or its dish is switched to sold out; a dish with choices is sold out when it is switched off or
 * every choice is. `manualSoldOut` stays the item's own switch.
 */
export function sellerViews(
  items: ReadonlyArray<MenuItem>,
  used: Map<string, number>,
): Array<SellerMenuItemView> {
  const views = items.map((item) => sellerView(item, used));
  const byId = new Map(views.map((view) => [view.id, view]));
  const choicesOf = new Map<string, Array<SellerMenuItemView>>();
  for (const view of views) {
    if (view.groupId === undefined) continue;
    choicesOf.set(view.groupId, [...(choicesOf.get(view.groupId) ?? []), view]);
  }
  return views.map((view) => {
    const parent = view.groupId === undefined ? undefined : byId.get(view.groupId);
    if (parent) return parent.manualSoldOut === true ? { ...view, soldOut: true } : view;
    const choices = choicesOf.get(view.id);
    return choices && choices.every((choice) => choice.soldOut) ? { ...view, soldOut: true } : view;
  });
}

/** The copy of a library dish that goes on a menu, with its own id. */
export function itemFromDish(dish: Dish, id: string, groupId?: string): MenuItem {
  return {
    id,
    ...(groupId !== undefined ? { groupId } : {}),
    name: { ...dish.name },
    description: { ...dish.description },
    size: { ...dish.size },
    priceCents: dish.priceCents,
    ...(dish.limit !== undefined ? { limit: dish.limit } : {}),
    ...(dish.chefId !== undefined ? { chefId: dish.chefId } : {}),
    ...(dish.preorder === false ? { preorder: false } : {}),
    ...(dish.dayStock !== undefined ? { dayStock: dish.dayStock } : {}),
    ...(dish.pictureRef !== undefined ? { pictureRef: dish.pictureRef } : {}),
  };
}
