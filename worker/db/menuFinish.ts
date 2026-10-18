// Per-chef summary and finishing menus (by hand or at midnight after the cooking day), split out of
// menus.ts (plan 098 C3; the code is unchanged).
import { menuFinishesAt } from '../../shared/dates';
import { DEFAULT_ZONE } from '../../shared/zone';
import { PAST_MENU_PICTURES_KEPT } from '../../shared/limits';
import { parseChefSummaryResponse, type ChefSummaryRow } from '../../shared/chefSummaryContract';
import { summariseOrders } from '../../shared/pastWeeks';
import { deleteImageRefs, type ImageBucket } from '../images/r2';
import { isFinalStatus } from '../../shared/status';
import { marks, type D1Statement, type Db } from './d1';
import { LIVE_MENU, liveMenu, readOrders } from './orders';
import { type MenuRow } from './rows';

// ---- Per-chef summary (plan 069) ------------------------------------------------------------

/** The stored snapshot: the owner's rows. Null-safe against a damaged value ("not kept"). */
export function parseSnapshot(text: string): Array<ChefSummaryRow> | undefined {
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
export async function readChefRows(
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
       WHERE o.seller_id = ? AND o.status <> 'cancelled' AND o.kind = 'menu'
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
  known?: MenuRow,
): Promise<FinishPlan | null> {
  // `known`: the caller has just read this seller's menu row, so it is not read twice.
  const row =
    known ?? (await db.first<MenuRow>('SELECT * FROM menus WHERE seller_id = ?', sellerId));
  if (!row || row.state === 'finished') return null;
  const orders = await readOrders(db, sellerId, LIVE_MENU);
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
               WHERE o.seller_id = ? AND ${LIVE_MENU} AND o.status NOT IN ('collected', 'delivered', 'cancelled')`,
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
               WHERE seller_id = ? AND ${liveMenu('')} AND status NOT IN ('collected', 'delivered', 'cancelled')`,
              at,
              sellerId,
            ),
          ]
        : []),
      // The week is over: its orders have nothing more to push (cascade deletes the rest later).
      db.stmt(
        `DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id IN
           (SELECT o.id FROM orders o WHERE o.seller_id = ? AND ${LIVE_MENU})`,
        sellerId,
        sellerId,
      ),
      db.stmt(
        `UPDATE orders SET past_week_id = ? WHERE seller_id = ? AND ${liveMenu('')}`,
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
  known?: MenuRow,
): Promise<{ finished: boolean; closedOrders: number; prunedPictures: Array<string> }> {
  const plan = await planFinish(db, sellerId, now, true, known);
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
 * midnight in the kitchen's own zone (kitchens.time_zone) after it. Idempotent: a finished menu is skipped, so an hourly run is cheap.
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
  const live = await db.all<{ seller_id: string; cooking_date: string; time_zone: string | null }>(
    `SELECT m.seller_id, m.cooking_date, k.time_zone FROM menus m
     LEFT JOIN kitchens k ON k.seller_id = m.seller_id WHERE m.state = 'live'`,
  );
  // At most MAX_FINISH_PER_RUN a run: the free plan allows 50 D1 queries per invocation, and a
  // menu takes about 3. Whatever is left is still due at the next hourly run.
  const due = live
    .filter(
      (menu) =>
        Date.parse(menuFinishesAt(menu.cooking_date, menu.time_zone ?? DEFAULT_ZONE)) <=
        now.getTime(),
    )
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
