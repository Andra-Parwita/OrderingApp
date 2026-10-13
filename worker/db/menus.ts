// Menus and dishes on D1 (plan 001, stage 3): the one menu a seller has, "Your dishes", saved sets of
// dishes, saved pickup places, the theme and menu defaults, and finishing a menu (by hand or at
// midnight after its cooking day). Every query filters by `seller_id` (D-036). Rules that write
// several rows send them as one batch, which D1 runs as one transaction.
import { comingSaturday, cutoffAtFor, menuFinishesAt } from '../../shared/dates';
import type { InboxEntry, PickupPoint, SellerOrder } from '../../shared/domain';
import {
  MAX_DISHES,
  MAX_MENU_ITEMS,
  MAX_PICKUP_PLACES,
  MAX_SETS,
  PAST_MENU_PICTURES_KEPT,
} from '../../shared/limits';
import {
  importRowProblem,
  type Dish,
  type FinishMenuResponse,
  type ImportProblem,
  type ImportRowResult,
  type MenuView,
  type Preferences,
} from '../../shared/menusContract';
import { parseChefSummaryResponse, type ChefSummaryRow } from '../../shared/chefSummaryContract';
import { summariseOrders } from '../../shared/pastWeeks';
import { deleteImageRefs, type ImageBucket } from '../images/r2';
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

/** What the seller just told a customer: the order as it now is, and the inbox entries added (oldest first). */
export type CustomerNotice = { order: SellerOrder; entries: Array<InboxEntry> };

export type MenuDeps = {
  db: Db;
  now: () => Date;
  newId: () => string;
  /**
   * Called once a write that told customers something has finished (never inside it), so the Worker
   * can send web pushes afterwards (worker/push/dispatch.ts). Absent in most tests.
   */
  notify?: (notices: Array<CustomerNotice>) => void;
};

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
  | 'usePastMenuPicture'
  | 'finishMenuNow'
  | 'listDishes'
  | 'createDish'
  | 'updateDish'
  | 'importDishes'
  | 'deleteDish'
  | 'listDishSets'
  | 'createDishSet'
  | 'useDishSet'
  | 'addDishToMenu'
  | 'listPickupPlaces'
  | 'createPickupPlace'
  | 'updatePickupPlace'
  | 'deletePickupPlace'
  | 'getPreferences'
  | 'setPreferences'
  | 'getChefSummary'
>;

function fail(error: ApiErrorCode, message: string) {
  return { ok: false as const, error, message };
}
function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

// ---- Per-chef summary (plan 069) ------------------------------------------------------------

/** The stored snapshot: the owner's rows. Null-safe against a damaged value ("not kept"). */
function parseSnapshot(text: string): Array<ChefSummaryRow> | undefined {
  try {
    const parsed = parseChefSummaryResponse({
      menuId: '',
      cookingDate: '',
      totalPortions: 0,
      totalCents: 0,
      rows: (JSON.parse(text) as { rows?: unknown }).rows,
    });
    return parsed?.rows;
  } catch {
    return undefined;
  }
}

/**
 * One batch (menu, setting, chefs, dishes' chefs, two sums): the owner's view of the menu the
 * kitchen has now (current, or finished and not yet replaced), the only one that still knows each
 * dish's chef. Chefs first by income, "Whole kitchen" last and only when it has something.
 */
async function readChefRows(
  db: Db,
  sid: string,
): Promise<{ menu: MenuRow | undefined; seeIncome: boolean; rows: Array<ChefSummaryRow> }> {
  const [menus, setting, chefs, onMenu, orderSums, saleSums] = await db.reads([
    db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
    db.stmt('SELECT chefs_see_income FROM kitchen_settings WHERE seller_id = ?', sid),
    db.stmt('SELECT id, name FROM chefs WHERE seller_id = ?', sid),
    db.stmt('SELECT DISTINCT chef_id FROM menu_items WHERE seller_id = ?', sid),
    db.stmt(
      `SELECT i.chef_id AS chef_id, SUM(l.qty) AS qty, SUM(l.qty * l.price_cents) AS cents
       FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
       LEFT JOIN menu_items i ON i.seller_id = l.seller_id AND i.id = l.item_id
       WHERE o.seller_id = ? AND o.status <> 'cancelled'
         AND COALESCE(o.past_week_id, (SELECT id FROM menus WHERE seller_id = ?)) = (SELECT id FROM menus WHERE seller_id = ?)
       GROUP BY i.chef_id`,
      sid,
      sid,
      sid,
    ),
    db.stmt(
      `SELECT i.chef_id AS chef_id, SUM(-s.change) AS qty, SUM(-s.change * i.price_cents) AS cents
       FROM day_sales s JOIN menu_items i ON i.seller_id = s.seller_id AND i.id = s.item_id
       WHERE s.seller_id = ? AND s.menu_id = (SELECT id FROM menus WHERE seller_id = ?)
         AND s.kind = 'sale' AND s.undone = 0
       GROUP BY i.chef_id`,
      sid,
      sid,
    ),
  ]);
  type Sum = { chef_id: string | null; qty: number; cents: number };
  const byChef = new Map<
    string | null,
    { portions: number; preOrderCents: number; stallCents: number }
  >();
  const slot = (chefId: string | null) => {
    const found = byChef.get(chefId) ?? { portions: 0, preOrderCents: 0, stallCents: 0 };
    byChef.set(chefId, found);
    return found;
  };
  for (const sum of orderSums as Array<Sum>) {
    const row = slot(sum.chef_id);
    row.portions += sum.qty;
    row.preOrderCents += sum.cents;
  }
  for (const sum of saleSums as Array<Sum>) {
    const row = slot(sum.chef_id);
    row.portions += sum.qty;
    row.stallCents += sum.cents;
  }
  const names = new Map((chefs as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));
  for (const item of onMenu as Array<{ chef_id: string | null }>) {
    if (item.chef_id !== null && names.has(item.chef_id)) slot(item.chef_id);
  }
  const rows: Array<ChefSummaryRow> = [];
  for (const [chefId, v] of byChef) {
    const name = chefId === null ? undefined : names.get(chefId);
    if (chefId !== null && name === undefined) continue;
    rows.push({
      chefId,
      ...(name !== undefined ? { name } : {}),
      portions: v.portions,
      preOrderCents: v.preOrderCents,
      stallCents: v.stallCents,
      incomeCents: v.preOrderCents + v.stallCents,
    });
  }
  rows.sort(
    (a, b) =>
      Number(a.chefId === null) - Number(b.chefId === null) ||
      b.incomeCents - a.incomeCents ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  );
  return {
    menu: (menus as Array<MenuRow>)[0],
    seeIncome: (setting as Array<{ chefs_see_income: number }>)[0]?.chefs_see_income !== 0,
    rows: rows.filter((r) => r.chefId !== null || r.portions > 0 || r.incomeCents > 0),
  };
}

// ---- Finishing -----------------------------------------------------------------------------

/** See finishDueMenus. */
export const MAX_FINISH_PER_RUN = 12;

export type FinishPlan = {
  row: MenuRow;
  statements: Array<D1Statement>;
  closedOrders: number;
  /** Plan 064: pictures of past menus beyond the newest PAST_MENU_PICTURES_KEPT, cleared by this finish. */
  prunedPictures: Array<string>;
};

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
  // Plan 064: the finished menu keeps its picture on its past-menu row; the newest
  // PAST_MENU_PICTURES_KEPT keep theirs, so the ones that fall out now are the old rows from the
  // (KEPT - 1)th on, before this one is added. Their files are deleted by the caller if unused.
  const older = await db.all<{ picture_ref: string | null }>(
    'SELECT picture_ref FROM past_weeks WHERE seller_id = ? ORDER BY rowid DESC LIMIT -1 OFFSET ?',
    sellerId,
    PAST_MENU_PICTURES_KEPT - 1,
  );
  const prunedPictures = older.flatMap((past) =>
    past.picture_ref === null ? [] : [past.picture_ref],
  );
  // Plan 069: the per-chef figures are kept on the past-menu row (one read; the menu's dishes and
  // chefs are gone once the next menu starts).
  const chefSummary = JSON.stringify({ rows: (await readChefRows(db, sellerId)).rows });
  return {
    row,
    closedOrders: open.length,
    prunedPictures,
    statements: [
      db.stmt(
        `INSERT INTO past_weeks (seller_id, id, cooking_date, closed_at, orders_count, cancelled_count, income_cents,
           paid_cents, unpaid_cents, details_dropped_at, picture_ref, chef_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        sellerId,
        row.id,
        row.cooking_date,
        at,
        totals.orders,
        totals.cancelled,
        totals.incomeCents,
        totals.paidCents,
        totals.unpaidCents,
        row.picture_ref,
        chefSummary,
      ),
      ...(prunedPictures.length > 0
        ? [
            db.stmt(
              `UPDATE past_weeks SET picture_ref = NULL WHERE seller_id = ? AND picture_ref IS NOT NULL
                 AND rowid NOT IN (SELECT rowid FROM past_weeks WHERE seller_id = ? ORDER BY rowid DESC LIMIT ?)`,
              sellerId,
              sellerId,
              PAST_MENU_PICTURES_KEPT,
            ),
          ]
        : []),
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
      // The week is over: its orders have nothing more to push (cascade deletes the rest later).
      db.stmt('DELETE FROM push_subscriptions WHERE seller_id = ?', sellerId),
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
): Promise<{ finished: boolean; closedOrders: number; prunedPictures: Array<string> }> {
  const plan = await planFinish(db, sellerId, now);
  if (!plan) return { finished: false, closedOrders: 0, prunedPictures: [] };
  try {
    await db.batch(plan.statements);
  } catch (error) {
    // A run that raced this one already archived the menu (same past-week id): nothing left to do.
    const again = await db.first<{ state: string }>(
      'SELECT state FROM menus WHERE seller_id = ?',
      sellerId,
    );
    if (again?.state === 'finished')
      return { finished: false, closedOrders: 0, prunedPictures: [] };
    throw error;
  }
  return { finished: true, closedOrders: plan.closedOrders, prunedPictures: plan.prunedPictures };
}

/**
 * The scheduled job (D-069 Q5): finishes every live menu whose cooking day has ended, i.e. at
 * midnight (Melbourne) after it. Idempotent: a finished menu is skipped, so an hourly run is cheap.
 */
export async function finishDueMenus(
  db: Db,
  now: Date,
): Promise<{
  menus: number;
  orders: number;
  failed: number;
  /** Plan 064: pictures pruned from past menus, per seller; delete them with deleteUnusedPictures. */
  pruned: Array<{ sellerId: string; refs: Array<string> }>;
}> {
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
  let failed = 0;
  const pruned: Array<{ sellerId: string; refs: Array<string> }> = [];
  for (const menu of due) {
    // One bad menu must not stop the others; it is still due at the next hourly run.
    try {
      const done = await finishMenu(db, menu.seller_id, now);
      if (done.finished) {
        menus++;
        orders += done.closedOrders;
        if (done.prunedPictures.length > 0) {
          pruned.push({ sellerId: menu.seller_id, refs: done.prunedPictures });
        }
      }
    } catch {
      failed++;
    }
  }
  return { menus, orders, failed, pruned };
}

/**
 * Plan 064: deletes the R2 files of pictures a finish just pruned, unless something still shows
 * them: the kitchen's pictures, a saved set, the menu, or another past menu (a picture reused by
 * the current menu or a newer past menu keeps its file).
 */
export async function deleteUnusedPictures(
  db: Db,
  bucket: ImageBucket,
  sellerId: string,
  refs: ReadonlyArray<string>,
): Promise<void> {
  if (refs.length === 0) return;
  const m = marks(refs.length);
  const rows = await db.reads([
    db.stmt(
      `SELECT ref FROM kitchen_images WHERE seller_id = ? AND ref IN (${m})`,
      sellerId,
      ...refs,
    ),
    db.stmt(
      `SELECT ref FROM saved_set_images WHERE seller_id = ? AND ref IN (${m})`,
      sellerId,
      ...refs,
    ),
    db.stmt(
      `SELECT picture_ref AS ref FROM menus WHERE seller_id = ? AND picture_ref IN (${m})`,
      sellerId,
      ...refs,
    ),
    db.stmt(
      `SELECT picture_ref AS ref FROM past_weeks WHERE seller_id = ? AND picture_ref IN (${m})`,
      sellerId,
      ...refs,
    ),
  ]);
  const inUse = new Set((rows.flat() as Array<{ ref: string }>).map((row) => row.ref));
  await deleteImageRefs(
    bucket,
    refs.filter((ref) => !inUse.has(ref)),
    sellerId,
  );
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
      // Plan 064: "start from a past menu" brings its picture along (the same file, no new upload).
      const fromPast = request.pictureFromPastMenu;
      const pastPicture =
        fromPast === undefined
          ? null
          : ((
              await db.first<{ picture_ref: string | null }>(
                'SELECT picture_ref FROM past_weeks WHERE seller_id = ? AND id = ?',
                sid,
                fromPast,
              )
            )?.picture_ref ?? null);
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
          ...(pastPicture !== null ? { pictureRef: pastPicture } : {}),
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

    async publishMenu(force = false, takingOrders?: boolean) {
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
            "UPDATE menus SET state = 'live', published_at = ?, wizard_step = 3, taking_orders = ? WHERE seller_id = ?",
            nowIso(),
            // Only a not-published menu is changed; `undefined` keeps the switch as it is.
            takingOrders === undefined ? row.taking_orders : takingOrders ? 1 : 0,
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

    /** Plan 064: the current menu takes the picture a past menu kept (the same file, no upload). */
    async usePastMenuPicture(pastMenuId) {
      const row = await menuRow();
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const past = await db.first<{ picture_ref: string | null }>(
        'SELECT picture_ref FROM past_weeks WHERE seller_id = ? AND id = ?',
        sid,
        pastMenuId,
      );
      if (!past?.picture_ref) return fail('not_found', 'That past menu has no picture');
      await db
        .stmt('UPDATE menus SET picture_ref = ? WHERE seller_id = ?', past.picture_ref, sid)
        .run();
      return ok({ view: await readView(), before: row.picture_ref ?? undefined });
    },

    async finishMenuNow() {
      const row = await menuRow();
      if (row.state !== 'live') return fail('menu_not_live', 'Only a live menu can be finished');
      const done = await finishMenu(db, sid, deps.now());
      return ok({
        menu: await readView(),
        closedOrders: done.closedOrders,
        prunedPictures: done.prunedPictures,
      } satisfies FinishMenuResponse & { prunedPictures: Array<string> });
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
        ...(input.preorder === false ? { preorder: false } : {}),
        ...(input.dayStock !== undefined ? { dayStock: input.dayStock } : {}),
      };
      await dishStatement(db, sid, dish, nowIso()).run();
      return ok(dish);
    },

    async importDishes(input, asChefId) {
      const [dishes, chefs] = await Promise.all([
        db
          .all<DishRow>('SELECT * FROM dishes WHERE seller_id = ?', sid)
          .then((found) => found.map(dishOf)),
        db.all<{ id: string; name: string }>('SELECT id, name FROM chefs WHERE seller_id = ?', sid),
      ]);
      const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      const problem = (code: ImportProblem['code'], message: string): ImportProblem => ({
        code,
        message,
      });
      const myName = chefs.find((chef) => chef.id === asChefId)?.name;
      const seen = new Set<string>();
      const writes: Array<{ dish: Dish; isNew: boolean }> = [];
      const rows = input.rows.map((row): ImportRowResult => {
        const name = row.nameEn.trim() || row.nameId.trim();
        const error = (p: ImportProblem): ImportRowResult => ({
          status: 'error',
          name,
          problem: p,
        });
        const wrong = importRowProblem(row);
        if (wrong) return error(wrong);
        // A signed-in chef: only their own dishes; an empty cook means themselves (as on create).
        let chefName = row.chef.trim();
        if (asChefId !== undefined) {
          if (chefName === '') chefName = myName ?? '';
          else if (!same(chefName, myName ?? '')) {
            return error(problem('not_yours', `Only your own dishes (not ${chefName})`));
          }
        }
        const chef = chefName === '' ? undefined : chefs.find((c) => same(c.name, chefName));
        if (chefName !== '' && !chef)
          return error(problem('unknown_chef', `Unknown cook "${chefName}"`));
        const key = JSON.stringify([name.toLowerCase(), chef?.id ?? '']);
        if (seen.has(key)) {
          return error(problem('duplicate', `${name} appears twice for this cook in the file`));
        }
        seen.add(key);
        const matches = dishes.filter(
          (d) =>
            same(row.nameEn.trim() === '' ? d.name.id : d.name.en, name) &&
            (d.chefId ?? '') === (chef?.id ?? ''),
        );
        if (matches.length > 1) {
          return error(problem('ambiguous', `More than one dish called ${name} for this cook`));
        }
        const dish: Dish = {
          id: matches[0]?.id ?? deps.newId(),
          name: { en: row.nameEn.trim() || name, id: row.nameId.trim() || name },
          description: { en: row.descriptionEn.trim(), id: row.descriptionId.trim() },
          size: { en: row.size.trim(), id: row.size.trim() },
          priceCents: row.priceCents,
          ...(row.limit !== undefined ? { limit: row.limit } : {}),
          ...(chef ? { chefId: chef.id } : {}),
          ...(!row.preorder ? { preorder: false } : {}),
          ...(row.dayStock !== undefined ? { dayStock: row.dayStock } : {}),
        };
        writes.push({ dish, isNew: matches.length === 0 });
        return { status: matches.length === 0 ? 'new' : 'update', name, dishId: dish.id };
      });
      const counts = {
        new: rows.filter((r) => r.status === 'new').length,
        update: rows.filter((r) => r.status === 'update').length,
        error: rows.filter((r) => r.status === 'error').length,
      };
      const overLimit = dishes.length + counts.new > MAX_DISHES;
      if (input.apply) {
        if (overLimit) {
          return fail(
            'limit_reached',
            `At most ${String(MAX_DISHES)} dishes: you have ${String(dishes.length)} and this adds ${String(counts.new)}`,
          );
        }
        const at = nowIso();
        await db.batch(
          writes.map(({ dish, isNew }) =>
            isNew
              ? dishStatement(db, sid, dish, at)
              : db.stmt(
                  `UPDATE dishes SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
                     price_cents = ?, portion_limit = ?, chef_id = ?, preorder = ?, day_stock = ?
                   WHERE seller_id = ? AND id = ?`,
                  dish.name.en,
                  dish.name.id,
                  dish.description.en,
                  dish.description.id,
                  dish.size.en,
                  dish.size.id,
                  dish.priceCents,
                  dish.limit ?? null,
                  dish.chefId ?? null,
                  dish.preorder !== false,
                  dish.dayStock ?? null,
                  sid,
                  dish.id,
                ),
          ),
        );
      }
      return ok({ applied: input.apply, rows, counts, overLimit });
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
      if (patch.preorder === true) delete next.preorder;
      else if (patch.preorder === false) next.preorder = false;
      if (patch.dayStock === null) delete next.dayStock;
      else if (patch.dayStock !== undefined) next.dayStock = patch.dayStock;
      if (next.preorder === false && next.dayStock === undefined) {
        return fail('invalid_request', 'On the day only needs a day stock');
      }
      await db
        .stmt(
          `UPDATE dishes SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
             price_cents = ?, portion_limit = ?, chef_id = ?, preorder = ?, day_stock = ?
           WHERE seller_id = ? AND id = ?`,
          next.name.en,
          next.name.id,
          next.description.en,
          next.description.id,
          next.size.en,
          next.size.id,
          next.priceCents,
          next.limit ?? null,
          next.chefId ?? null,
          next.preorder !== false,
          next.dayStock ?? null,
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

    /** D-094: appends one library dish to the menu; the other items are not touched. */
    async addDishToMenu(dishId) {
      const [row, items, dish] = await Promise.all([
        menuRow(),
        db.all<ItemRow>('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
        dishRow(dishId),
      ]);
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      if (!dish) return fail('unknown_item', 'Unknown dish');
      if (items.some((item) => item.dish_id === dishId)) {
        return fail('already_on_menu', 'This dish is already on the menu');
      }
      if (items.length >= MAX_MENU_ITEMS) {
        return fail('limit_reached', `At most ${String(MAX_MENU_ITEMS)} dishes on a menu`);
      }
      const top = items.reduce((max, item) => Math.max(max, item.position), -1);
      await db.batch(copyStatements([dish], top + 1));
      return ok(await readView());
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

    // Plan 069: one batch (chefs, dishes' chefs, two sums). Only the menu the kitchen has
    // (current, or finished and not yet replaced) still knows each dish's chef.
    async getChefSummary(id, asChefId) {
      const { menu: mine, seeIncome, rows } = await readChefRows(db, sid);
      let kept: { menuId: string; cookingDate: string; rows: Array<ChefSummaryRow> } | undefined;
      if (mine && (id === 'current' || id === mine.id)) {
        kept = { menuId: mine.id, cookingDate: mine.cooking_date, rows };
      } else {
        // Plan 069 stage 3: an older menu answers from the snapshot taken when it finished.
        const past = await db.first<{
          id: string;
          cooking_date: string;
          chef_summary: string | null;
        }>(
          'SELECT id, cooking_date, chef_summary FROM past_weeks WHERE seller_id = ? AND id = ?',
          sid,
          id,
        );
        const snapshot = past?.chef_summary ? parseSnapshot(past.chef_summary) : undefined;
        if (!past || !snapshot) return undefined;
        kept = { menuId: past.id, cookingDate: past.cooking_date, rows: snapshot };
      }
      if (asChefId !== undefined && !seeIncome) return 'private';
      const shown = kept.rows.filter((r) => asChefId === undefined || r.chefId === asChefId);
      return {
        menuId: kept.menuId,
        cookingDate: kept.cookingDate,
        rows: shown,
        totalPortions: shown.reduce((n, r) => n + r.portions, 0),
        totalCents: shown.reduce((n, r) => n + r.incomeCents, 0),
      };
    },

    async setPreferences(request) {
      const current = await readPreferences();
      const next: Preferences = {
        theme: request.theme ?? current.theme,
        menuDefaults: request.menuDefaults ?? current.menuDefaults,
        chefsSeeIncome: request.chefsSeeIncome ?? current.chefsSeeIncome ?? true,
      };
      await db
        .stmt(
          `UPDATE kitchen_settings SET theme = ?, default_cutoff_days = ?, default_cutoff_time = ?, default_delivery = ?,
             default_delivery_note_en = ?, default_delivery_note_id = ?, chefs_see_income = ? WHERE seller_id = ?`,
          next.theme,
          next.menuDefaults.cutoffDaysBefore,
          next.menuDefaults.cutoffTime,
          next.menuDefaults.delivery.available,
          next.menuDefaults.delivery.note.en,
          next.menuDefaults.delivery.note.id,
          next.chefsSeeIncome,
          sid,
        )
        .run();
      return next;
    },
  };
}
