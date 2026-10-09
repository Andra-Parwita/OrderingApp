// Menus and dishes on D1 (plan 001, stage 3): the one menu a seller has, "Your dishes", saved sets of
// dishes, saved pickup places, the theme and menu defaults, and finishing a menu (by hand or at
// midnight after its cooking day). Every query filters by `seller_id` (D-036). Rules that write
// several rows send them as one batch, which D1 runs as one transaction.
import { comingSaturday, cutoffAtFor, menuFinishesAt } from '../../shared/dates';
import type { PickupPoint } from '../../shared/domain';
import { MAX_DISHES, MAX_MENU_ITEMS, MAX_PICKUP_PLACES, MAX_SETS } from '../../shared/limits';
import type { FinishMenuResponse, MenuView, Preferences } from '../../shared/menusContract';
import { summariseOrders } from '../../shared/pastWeeks';
import { isFinalStatus } from '../../shared/status';
import type { ApiErrorCode, ApiWarning } from '../../shared/apiError';
import { checkImageUpload } from '../../shared/imageSlots';
import type { SellerRepository, StoreResult } from '../repo/Repository';
import { marks, type D1Statement, type Db } from './d1';
import { itemFromDish, MENU_PLACES_SQL, sellerView, USED_SQL } from './menuView';
import { readOrders } from './orders';
import {
  dishOf,
  itemOf,
  menuOf,
  pickupOf,
  preferencesOf,
  type DishRow,
  type ItemRow,
  type MenuPlaceRow,
  type MenuRow,
  type PickupRow,
  type SetDishRow,
  type SetRow,
  type SettingsRow,
} from './rows';
import { dishStatement, itemStatement, menuStatements, setStatements } from './write';

export type MenuDeps = { db: Db; now: () => Date; newId: () => string };

/** The repository methods this file implements. */
export type MenuOps = Pick<
  SellerRepository,
  | 'getCurrentMenu'
  | 'createMenu'
  | 'updateMenu'
  | 'publishMenu'
  | 'unpublishMenu'
  | 'deleteMenu'
  | 'setMenuPicture'
  | 'removeMenuPicture'
  | 'finishMenuNow'
  | 'listDishes'
  | 'createDish'
  | 'updateDish'
  | 'deleteDish'
  | 'listDishSets'
  | 'createDishSet'
  | 'useDishSet'
  | 'listPickupPlaces'
  | 'createPickupPlace'
  | 'updatePickupPlace'
  | 'deletePickupPlace'
  | 'getPreferences'
  | 'setPreferences'
>;

function fail(error: ApiErrorCode, message: string) {
  return { ok: false as const, error, message };
}
function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

// ---- Finishing -----------------------------------------------------------------------------

/** See finishDueMenus. */
export const MAX_FINISH_PER_RUN = 12;

export type FinishPlan = { row: MenuRow; statements: Array<D1Statement>; closedOrders: number };

/**
 * Everything that finishing a seller's menu writes: the closed week with its totals (under the
 * menu's id, so "Past menus" and the retention job work as before), still-open orders closed
 * (pickup -> collected, delivery -> delivered, with a line in the customer's inbox), the orders
 * moved out of the live list, and the menu set to finished. `closeOpenOrders: false` (the legacy
 * week/close, plan 001) leaves order statuses alone. Null when there is nothing to finish
 * (already finished), which is what makes a repeated run harmless.
 */
export async function planFinish(
  db: Db,
  sellerId: string,
  now: Date,
  closeOpenOrders = true,
): Promise<FinishPlan | null> {
  const row = await db.first<MenuRow>('SELECT * FROM menus WHERE seller_id = ?', sellerId);
  if (!row || row.state === 'finished') return null;
  const orders = await readOrders(db, sellerId, 'o.past_week_id IS NULL');
  const totals = summariseOrders(orders);
  const open = closeOpenOrders ? orders.filter((order) => !isFinalStatus(order.status)) : [];
  const at = now.toISOString();
  return {
    row,
    closedOrders: open.length,
    statements: [
      db.stmt(
        `INSERT INTO past_weeks (seller_id, id, cooking_date, closed_at, orders_count, cancelled_count, income_cents,
           paid_cents, unpaid_cents, details_dropped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        sellerId,
        row.id,
        row.cooking_date,
        at,
        totals.orders,
        totals.cancelled,
        totals.incomeCents,
        totals.paidCents,
        totals.unpaidCents,
      ),
      ...totals.items.map((item, position) =>
        db.stmt(
          `INSERT INTO past_week_items (seller_id, past_week_id, position, item_id, name_en, name_id, qty)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          sellerId,
          row.id,
          position,
          item.itemId,
          item.name.en,
          item.name.id,
          item.qty,
        ),
      ),
      // The inbox line first (it reads the orders that are still open right now): one statement for
      // all of them, so the number of statements does not grow with the orders. The inbox cap
      // trigger runs for each row.
      ...(closeOpenOrders
        ? [
            db.stmt(
              `INSERT INTO order_inbox (seller_id, order_id, seq, at, kind, status)
               SELECT o.seller_id, o.id,
                 COALESCE((SELECT MAX(i.seq) FROM order_inbox i WHERE i.seller_id = o.seller_id AND i.order_id = o.id), 0) + 1,
                 ?, 'status', CASE o.fulfilment WHEN 'pickup' THEN 'collected' ELSE 'delivered' END
               FROM orders o
               WHERE o.seller_id = ? AND o.past_week_id IS NULL AND o.status NOT IN ('collected', 'delivered', 'cancelled')`,
              at,
              sellerId,
            ),
          ]
        : []),
      ...(closeOpenOrders
        ? [
            db.stmt(
              `UPDATE orders SET status = CASE fulfilment WHEN 'pickup' THEN 'collected' ELSE 'delivered' END,
                 changed = 0, updated_at = ?
               WHERE seller_id = ? AND past_week_id IS NULL AND status NOT IN ('collected', 'delivered', 'cancelled')`,
              at,
              sellerId,
            ),
          ]
        : []),
      db.stmt(
        'UPDATE orders SET past_week_id = ? WHERE seller_id = ? AND past_week_id IS NULL',
        row.id,
        sellerId,
      ),
      db.stmt(
        "UPDATE menus SET state = 'finished', finished_at = ? WHERE seller_id = ?",
        at,
        sellerId,
      ),
    ],
  };
}

/** Finishes one seller's menu (see planFinish). Idempotent. */
export async function finishMenu(
  db: Db,
  sellerId: string,
  now: Date,
): Promise<{ finished: boolean; closedOrders: number }> {
  const plan = await planFinish(db, sellerId, now);
  if (!plan) return { finished: false, closedOrders: 0 };
  try {
    await db.batch(plan.statements);
  } catch (error) {
    // A run that raced this one already archived the menu (same past-week id): nothing left to do.
    const again = await db.first<{ state: string }>(
      'SELECT state FROM menus WHERE seller_id = ?',
      sellerId,
    );
    if (again?.state === 'finished') return { finished: false, closedOrders: 0 };
    throw error;
  }
  return { finished: true, closedOrders: plan.closedOrders };
}

/**
 * The scheduled job (D-069 Q5): finishes every live menu whose cooking day has ended, i.e. at
 * midnight (Melbourne) after it. Idempotent: a finished menu is skipped, so an hourly run is cheap.
 */
export async function finishDueMenus(
  db: Db,
  now: Date,
): Promise<{ menus: number; orders: number }> {
  const live = await db.all<{ seller_id: string; cooking_date: string }>(
    "SELECT seller_id, cooking_date FROM menus WHERE state = 'live'",
  );
  // At most MAX_FINISH_PER_RUN a run: the free plan allows 50 D1 queries per invocation, and a
  // menu takes about 3. Whatever is left is still due at the next hourly run.
  const due = live
    .filter((menu) => Date.parse(menuFinishesAt(menu.cooking_date)) <= now.getTime())
    .slice(0, MAX_FINISH_PER_RUN);
  let menus = 0;
  let orders = 0;
  for (const menu of due) {
    const done = await finishMenu(db, menu.seller_id, now);
    if (done.finished) {
      menus++;
      orders += done.closedOrders;
    }
  }
  return { menus, orders };
}

// ---- The operations ------------------------------------------------------------------------

export function createMenuOps(deps: MenuDeps, sid: string): MenuOps {
  const { db } = deps;
  const nowIso = () => deps.now().toISOString();

  async function readView(): Promise<MenuView> {
    const [menus, uses, points, items, used] = await db.reads([
      db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
      db.stmt(
        'SELECT place_id, window_start, window_end FROM menu_pickup_places WHERE seller_id = ? ORDER BY position',
        sid,
      ),
      db.stmt(MENU_PLACES_SQL, sid),
      db.stmt('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      db.stmt(`${USED_SQL} GROUP BY l.item_id`, sid),
    ]);
    const row = menus[0] as MenuRow | undefined;
    if (!row) throw new Error(`Seller ${sid} has no menu`);
    const usedMap = new Map(
      (used as Array<{ item_id: string; used: number }>).map((r) => [r.item_id, r.used]),
    );
    return {
      menu: menuOf(row, uses as Array<MenuPlaceRow>),
      dishes: (items as Array<ItemRow>).map((item) => ({
        ...sellerView(itemOf(item), usedMap),
        ...(item.dish_id !== null ? { dishId: item.dish_id } : {}),
      })),
      pickupPoints: (points as Array<PickupRow>).map(pickupOf),
    };
  }

  async function readPreferences(): Promise<Preferences> {
    const row = await db.first<SettingsRow>(
      'SELECT * FROM kitchen_settings WHERE seller_id = ?',
      sid,
    );
    return preferencesOf(row as SettingsRow);
  }

  async function menuRow(): Promise<MenuRow> {
    const row = await db.first<MenuRow>('SELECT * FROM menus WHERE seller_id = ?', sid);
    if (!row) throw new Error(`Seller ${sid} has no menu`);
    return row;
  }

  async function dishRow(id: string): Promise<DishRow | null> {
    return db.first<DishRow>('SELECT * FROM dishes WHERE seller_id = ? AND id = ?', sid, id);
  }

  async function chefExists(chefId: string): Promise<boolean> {
    return (
      (await db.first('SELECT 1 AS hit FROM chefs WHERE seller_id = ? AND id = ?', sid, chefId)) !==
      null
    );
  }

  /** Statements that put copies of library dishes on the menu, after `position` items. */
  function copyStatements(dishes: ReadonlyArray<DishRow>, from: number): Array<D1Statement> {
    return [
      ...dishes.map((dish, index) =>
        itemStatement(db, sid, itemFromDish(dishOf(dish), deps.newId()), from + index, dish.id),
      ),
      ...(dishes.length > 0
        ? [
            db.stmt(
              `UPDATE dishes SET last_used_at = ? WHERE seller_id = ? AND id IN (${marks(dishes.length)})`,
              nowIso(),
              sid,
              ...dishes.map((dish) => dish.id),
            ),
          ]
        : []),
    ];
  }

  return {
    // ---- The menu ----

    getCurrentMenu: readView,

    async createMenu(request) {
      const [menus, uses, settings] = await db.reads([
        db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
        db.stmt(
          'SELECT place_id FROM menu_pickup_places WHERE seller_id = ? ORDER BY position',
          sid,
        ),
        db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
      ]);
      const current = menus[0] as MenuRow | undefined;
      if (current && current.state !== 'finished') {
        return fail('menu_in_progress', 'Finish the current menu before making a new one');
      }
      const defaults = preferencesOf(settings[0] as SettingsRow).menuDefaults;
      const cookingDate = request.cookingDate ?? comingSaturday(deps.now());
      await db.batch([
        db.stmt('DELETE FROM menu_items WHERE seller_id = ?', sid),
        db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', sid),
        db.stmt('DELETE FROM menus WHERE seller_id = ?', sid),
        ...menuStatements(db, sid, {
          id: deps.newId(),
          state: 'not_published',
          cookingDate,
          cutoffAt: cutoffAtFor(cookingDate, defaults.cutoffDaysBefore, defaults.cutoffTime),
          delivery: defaults.delivery,
          wizardStep: 0,
          takingOrders: true,
          // The new menu starts with the places the last one used, at their usual times.
          placeUses: (uses as Array<{ place_id: string }>).map((use) => ({
            placeId: use.place_id,
          })),
        }),
      ]);
      return ok(await readView());
    },

    async updateMenu(request) {
      const [menus, settings, placeRows, itemRows] = await db.reads([
        db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
        db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
        db.stmt('SELECT id FROM pickup_places WHERE seller_id = ?', sid),
        db.stmt('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      ]);
      const row = menus[0] as MenuRow;
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const known = new Set((placeRows as Array<{ id: string }>).map((place) => place.id));
      if (request.places?.some((use) => !known.has(use.placeId))) {
        return fail('not_found', 'Unknown pickup place');
      }
      const defaults = preferencesOf(settings[0] as SettingsRow).menuDefaults;
      const cookingDate = request.cookingDate ?? row.cooking_date;
      // A new cooking day without a new cut-off gets the usual cut-off for that day.
      const cutoffAt =
        request.cutoffAt ??
        (cookingDate === row.cooking_date
          ? row.cutoff_at
          : cutoffAtFor(cookingDate, defaults.cutoffDaysBefore, defaults.cutoffTime));
      const statements: Array<D1Statement> = [
        db.stmt(
          `UPDATE menus SET cooking_date = ?, cutoff_at = ?, delivery_available = ?, delivery_note_en = ?,
             delivery_note_id = ?, wizard_step = ?, taking_orders = ? WHERE seller_id = ?`,
          cookingDate,
          cutoffAt,
          request.delivery?.available ?? row.delivery_available === 1,
          request.delivery?.note.en ?? row.delivery_note_en,
          request.delivery?.note.id ?? row.delivery_note_id,
          Math.max(row.wizard_step, request.wizardStep ?? 0),
          request.takingOrders ?? row.taking_orders === 1,
          sid,
        ),
      ];
      if (request.places) {
        statements.push(
          db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', sid),
          ...request.places.map((use, position) =>
            db.stmt(
              'INSERT INTO menu_pickup_places (seller_id, place_id, position, window_start, window_end) VALUES (?, ?, ?, ?, ?)',
              sid,
              use.placeId,
              position,
              use.window?.start ?? null,
              use.window?.end ?? null,
            ),
          ),
        );
      }
      let removed: Array<string> = [];
      if (request.dishIds) {
        const wanted = request.dishIds;
        const dishes =
          wanted.length === 0
            ? []
            : await db.all<DishRow>(
                `SELECT * FROM dishes WHERE seller_id = ? AND id IN (${marks(wanted.length)})`,
                sid,
                ...wanted,
              );
        const byId = new Map(dishes.map((dish) => [dish.id, dish]));
        if (wanted.some((id) => !byId.has(id))) return fail('unknown_item', 'Unknown dish');
        const items = itemRows as Array<ItemRow>;
        const kept = new Map(
          items.filter((item) => item.dish_id !== null).map((item) => [item.dish_id, item]),
        );
        removed = items
          .filter((item) => item.dish_id === null || !wanted.includes(item.dish_id))
          .map((item) => item.id);
        if (removed.length > 0) {
          statements.push(
            db.stmt(
              `DELETE FROM menu_items WHERE seller_id = ? AND id IN (${marks(removed.length)})`,
              sid,
              ...removed,
            ),
          );
        }
        const added: Array<DishRow> = [];
        wanted.forEach((dishId, position) => {
          const have = kept.get(dishId);
          if (have) {
            statements.push(
              db.stmt(
                'UPDATE menu_items SET position = ? WHERE seller_id = ? AND id = ?',
                position,
                sid,
                have.id,
              ),
            );
          } else added.push(byId.get(dishId) as DishRow);
        });
        // New copies go after the kept ones, in the order asked for.
        const positions = new Map(wanted.map((id, index) => [id, index]));
        statements.push(
          ...added.flatMap((dish) =>
            copyStatements([dish], positions.get(dish.id) ?? wanted.length),
          ),
        );
      }
      await db.batch(statements);
      // Dropping a dish that has orders is allowed (D-062); the screen is told which ones.
      const withOrders =
        removed.length === 0
          ? []
          : await db.all<{ item_id: string }>(
              `SELECT DISTINCT l.item_id AS item_id FROM order_lines l
               JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
               WHERE o.seller_id = ? AND o.past_week_id IS NULL AND o.status <> 'cancelled'
                 AND l.item_id IN (${marks(removed.length)})`,
              sid,
              ...removed,
            );
      return ok({
        menu: await readView(),
        warnings: { removedWithOrders: withOrders.map((hit) => hit.item_id) },
      });
    },

    async publishMenu(force = false) {
      const [row, count] = await Promise.all([
        menuRow(),
        db.first<{ n: number }>('SELECT COUNT(*) AS n FROM menu_items WHERE seller_id = ?', sid),
      ]);
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      // D-062: an empty menu is a warning the seller may override, not a block.
      if ((count?.n ?? 0) === 0 && !force && row.state === 'not_published') {
        const warning: ApiWarning = { code: 'no_dishes' };
        return { ok: false, error: 'no_items', message: 'This menu has no dishes yet', warning };
      }
      if (row.state === 'not_published') {
        await db
          .stmt(
            "UPDATE menus SET state = 'live', published_at = ?, wizard_step = 3 WHERE seller_id = ?",
            nowIso(),
            sid,
          )
          .run();
      }
      return ok(await readView());
    },

    /** Live back to not published; the orders already placed stay (D-062: the screen warns first). */
    async unpublishMenu() {
      const row = await menuRow();
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      if (row.state === 'live') {
        await db.stmt("UPDATE menus SET state = 'not_published' WHERE seller_id = ?", sid).run();
      }
      return ok(await readView());
    },

    /**
     * Throws away a menu that is not published yet (the screen warns first): its dishes and places go
     * and it counts as finished, so the seller is at 'no active menu' and may start a new one. It
     * leaves nothing in Past menus.
     */
    async deleteMenu() {
      const row = await menuRow();
      if (row.state !== 'not_published') {
        return fail('week_not_draft', 'Only a menu that is not published can be deleted');
      }
      await db.batch([
        db.stmt('DELETE FROM menu_items WHERE seller_id = ?', sid),
        db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', sid),
        db.stmt(
          "UPDATE menus SET state = 'finished', finished_at = ?, picture_ref = NULL WHERE seller_id = ?",
          nowIso(),
          sid,
        ),
      ]);
      return ok({ view: await readView(), before: row.picture_ref ?? undefined });
    },

    /** The menu picture (3:2, D-060): `ref` is the R2 path; without a bucket the data URL itself is kept. */
    async setMenuPicture(dataUrl, ref) {
      const row = await menuRow();
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const check = checkImageUpload('menuPicture', dataUrl);
      if (!check.ok) {
        const message = {
          image_type: 'Use a jpeg, png or webp image',
          image_too_big: 'The image is over 600 KB',
          image_ratio: 'The image has the wrong shape for this place',
        }[check.error];
        return fail(check.error, message);
      }
      await db
        .stmt(
          'UPDATE menus SET picture_ref = ? WHERE seller_id = ?',
          ref ?? (dataUrl as string),
          sid,
        )
        .run();
      return ok({ view: await readView(), before: row.picture_ref ?? undefined });
    },

    async removeMenuPicture() {
      const row = await menuRow();
      await db.stmt('UPDATE menus SET picture_ref = NULL WHERE seller_id = ?', sid).run();
      return { view: await readView(), before: row.picture_ref ?? undefined };
    },

    async finishMenuNow() {
      const row = await menuRow();
      if (row.state !== 'live') return fail('menu_not_live', 'Only a live menu can be finished');
      const done = await finishMenu(db, sid, deps.now());
      return ok({
        menu: await readView(),
        closedOrders: done.closedOrders,
      } satisfies FinishMenuResponse);
    },

    // ---- Your dishes ----

    async listDishes() {
      const rows = await db.all<DishRow>(
        `SELECT * FROM dishes WHERE seller_id = ?
         ORDER BY last_used_at IS NULL, last_used_at DESC, name_en COLLATE NOCASE, id`,
        sid,
      );
      return rows.map(dishOf);
    },

    async createDish(input) {
      const count = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM dishes WHERE seller_id = ?',
        sid,
      );
      if ((count?.n ?? 0) >= MAX_DISHES) {
        return fail('limit_reached', `At most ${String(MAX_DISHES)} dishes`);
      }
      if (input.chefId !== undefined && !(await chefExists(input.chefId))) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const dish = {
        id: deps.newId(),
        name: { ...input.name },
        description: { ...(input.description ?? { en: '', id: '' }) },
        size: { ...(input.size ?? { en: '', id: '' }) },
        priceCents: input.priceCents,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.chefId !== undefined ? { chefId: input.chefId } : {}),
      };
      await dishStatement(db, sid, dish, nowIso()).run();
      return ok(dish);
    },

    async updateDish(id, patch) {
      const row = await dishRow(id);
      if (!row) return fail('not_found', 'Dish not found');
      if (typeof patch.chefId === 'string' && !(await chefExists(patch.chefId))) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const next = dishOf(row);
      if (patch.name) next.name = { ...patch.name };
      if (patch.description) next.description = { ...patch.description };
      if (patch.size) next.size = { ...patch.size };
      if (patch.priceCents !== undefined) next.priceCents = patch.priceCents;
      if (patch.limit === null) delete next.limit;
      else if (patch.limit !== undefined) next.limit = patch.limit;
      if (patch.chefId === null) delete next.chefId;
      else if (patch.chefId !== undefined) next.chefId = patch.chefId;
      await db
        .stmt(
          `UPDATE dishes SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
             price_cents = ?, portion_limit = ?, chef_id = ? WHERE seller_id = ? AND id = ?`,
          next.name.en,
          next.name.id,
          next.description.en,
          next.description.id,
          next.size.en,
          next.size.id,
          next.priceCents,
          next.limit ?? null,
          next.chefId ?? null,
          sid,
          id,
        )
        .run();
      return ok(next);
    },

    /** Deleting a dish never touches a menu or an order; a live menu that uses it is only flagged (D-062). */
    async deleteDish(id) {
      if (!(await dishRow(id))) return fail('not_found', 'Dish not found');
      const onLive = await db.first(
        `SELECT 1 AS hit FROM menu_items i JOIN menus m ON m.seller_id = i.seller_id
         WHERE i.seller_id = ? AND i.dish_id = ? AND m.state = 'live'`,
        sid,
        id,
      );
      await db.batch([
        db.stmt(
          'UPDATE menu_items SET dish_id = NULL WHERE seller_id = ? AND dish_id = ?',
          sid,
          id,
        ),
        db.stmt('DELETE FROM saved_set_dishes WHERE seller_id = ? AND dish_id = ?', sid, id),
        db.stmt('DELETE FROM dishes WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok({ usedOnLiveMenu: onLive !== null });
    },

    // ---- Saved sets of dishes ----

    async listDishSets() {
      const [sets, links] = await db.reads([
        db.stmt('SELECT * FROM saved_sets WHERE seller_id = ? ORDER BY position', sid),
        db.stmt(
          'SELECT set_id, dish_id FROM saved_set_dishes WHERE seller_id = ? ORDER BY set_id, position',
          sid,
        ),
      ]);
      return (sets as Array<SetRow>).map((set) => ({
        id: set.id,
        name: set.name,
        dishIds: (links as Array<SetDishRow>)
          .filter((link) => link.set_id === set.id)
          .map((link) => link.dish_id),
        timesUsed: set.times_used,
      }));
    },

    async createDishSet(input) {
      const [count, found] = await Promise.all([
        db.first<{ n: number }>('SELECT COUNT(*) AS n FROM saved_sets WHERE seller_id = ?', sid),
        db.all<{ id: string }>(
          `SELECT id FROM dishes WHERE seller_id = ? AND id IN (${marks(input.dishIds.length)})`,
          sid,
          ...input.dishIds,
        ),
      ]);
      if ((count?.n ?? 0) >= MAX_SETS) {
        return fail('limit_reached', `At most ${String(MAX_SETS)} sets`);
      }
      if (found.length !== input.dishIds.length) return fail('unknown_item', 'Unknown dish');
      const set = { id: deps.newId(), name: input.name, dishIds: input.dishIds, timesUsed: 0 };
      await db.batch(
        setStatements(db, sid, { ...set, dishIds: [...set.dishIds], images: {} }, count?.n ?? 0),
      );
      return ok({ ...set, dishIds: [...set.dishIds] });
    },

    /** Adds the set's dishes to the menu (those already on it stay as they are). */
    async useDishSet(id) {
      const [setRow, links, row, items] = await Promise.all([
        db.first<SetRow>('SELECT * FROM saved_sets WHERE seller_id = ? AND id = ?', sid, id),
        db.all<SetDishRow>(
          'SELECT set_id, dish_id FROM saved_set_dishes WHERE seller_id = ? AND set_id = ? ORDER BY position',
          sid,
          id,
        ),
        menuRow(),
        db.all<ItemRow>('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      ]);
      if (!setRow) return fail('not_found', 'Set not found');
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const onMenu = new Set(items.map((item) => item.dish_id));
      const wanted = links.map((link) => link.dish_id).filter((dishId) => !onMenu.has(dishId));
      if (items.length + wanted.length > MAX_MENU_ITEMS) {
        return fail('limit_reached', `At most ${String(MAX_MENU_ITEMS)} dishes on a menu`);
      }
      const dishes =
        wanted.length === 0
          ? []
          : await db.all<DishRow>(
              `SELECT * FROM dishes WHERE seller_id = ? AND id IN (${marks(wanted.length)})`,
              sid,
              ...wanted,
            );
      const ordered = wanted.flatMap((dishId) => dishes.filter((dish) => dish.id === dishId));
      const top = items.reduce((max, item) => Math.max(max, item.position), -1);
      await db.batch([
        ...copyStatements(ordered, top + 1),
        db.stmt(
          'UPDATE saved_sets SET times_used = times_used + 1 WHERE seller_id = ? AND id = ?',
          sid,
          id,
        ),
      ]);
      return ok({ menu: await readView(), added: ordered.length });
    },

    // ---- Pickup places (D-061) ----

    async listPickupPlaces() {
      const rows = await db.all<PickupRow>(
        'SELECT * FROM pickup_places WHERE seller_id = ? ORDER BY position',
        sid,
      );
      return rows.map(pickupOf);
    },

    async createPickupPlace(input) {
      const counts = await db.first<{ n: number; top: number }>(
        'SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS top FROM pickup_places WHERE seller_id = ?',
        sid,
      );
      if ((counts?.n ?? 0) >= MAX_PICKUP_PLACES) {
        return fail(
          'pickup_place_limit',
          `At most ${String(MAX_PICKUP_PLACES)} pickup places; delete one first`,
        );
      }
      const place: PickupPoint = {
        id: deps.newId(),
        place: input.place,
        directions: { ...input.directions },
        window: { ...input.window },
      };
      await db
        .stmt(
          `INSERT INTO pickup_places (seller_id, id, position, place, directions_en, directions_id, window_start, window_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          sid,
          place.id,
          (counts?.top ?? -1) + 1,
          place.place,
          place.directions.en,
          place.directions.id,
          place.window.start,
          place.window.end,
        )
        .run();
      return ok(place);
    },

    async updatePickupPlace(id, patch) {
      const row = await db.first<PickupRow>(
        'SELECT * FROM pickup_places WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!row) return fail('not_found', 'Pickup place not found');
      const next = pickupOf(row);
      if (patch.place !== undefined) next.place = patch.place;
      if (patch.directions) next.directions = { ...patch.directions };
      if (patch.window) next.window = { ...patch.window };
      await db
        .stmt(
          `UPDATE pickup_places SET place = ?, directions_en = ?, directions_id = ?, window_start = ?, window_end = ?
           WHERE seller_id = ? AND id = ?`,
          next.place,
          next.directions.en,
          next.directions.id,
          next.window.start,
          next.window.end,
          sid,
          id,
        )
        .run();
      return ok(next);
    },

    /** The place leaves any menu that used it; a live menu that did is only flagged (D-062). */
    async deletePickupPlace(id) {
      const found = await db.first(
        'SELECT 1 AS hit FROM pickup_places WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Pickup place not found');
      const onLive = await db.first(
        `SELECT 1 AS hit FROM menu_pickup_places u JOIN menus m ON m.seller_id = u.seller_id
         WHERE u.seller_id = ? AND u.place_id = ? AND m.state = 'live'`,
        sid,
        id,
      );
      await db.batch([
        db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ? AND place_id = ?', sid, id),
        db.stmt('DELETE FROM pickup_places WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok({ usedOnLiveMenu: onLive !== null });
    },

    // ---- Theme and menu defaults ----

    getPreferences: readPreferences,

    async setPreferences(request) {
      const current = await readPreferences();
      const next: Preferences = {
        theme: request.theme ?? current.theme,
        menuDefaults: request.menuDefaults ?? current.menuDefaults,
      };
      await db
        .stmt(
          `UPDATE kitchen_settings SET theme = ?, default_cutoff_days = ?, default_cutoff_time = ?, default_delivery = ?,
             default_delivery_note_en = ?, default_delivery_note_id = ? WHERE seller_id = ?`,
          next.theme,
          next.menuDefaults.cutoffDaysBefore,
          next.menuDefaults.cutoffTime,
          next.menuDefaults.delivery.available,
          next.menuDefaults.delivery.note.en,
          next.menuDefaults.delivery.note.id,
          sid,
        )
        .run();
      return next;
    },
  };
}
