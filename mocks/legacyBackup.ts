// Test-only reference (plan 113 item 7): the backup export as it was before 1.0.44, built from twelve
// service calls. mocks/backupCompare.test.ts asserts the shipped export gives the same file, row by
// row, for the same database. Never imported by the Worker.
import { BACKUP_VERSION, type BackupFile } from '../shared/backup';
import type { PastWeek } from '../shared/pastWeeks';
import type { SavedSet } from '../shared/setupContract';
import type { Db } from '../worker/db/d1';
import { assembleOrders, LIVE_MENU, orderReadStatements } from '../worker/db/orders';
import type { SellerContext } from '../worker/db/sellerContext';

/** The old orders read, but with the plan 121 B anonymous facts, which a backup carries. */
async function readOrders(db: Db, sellerId: string, where: string) {
  const statements = orderReadStatements(db, `o.seller_id = ? AND (${where})`, [sellerId]);
  return assembleOrders(await db.batch(statements), true);
}

export async function legacyExportBackup(c: SellerContext): Promise<BackupFile> {
  const { db, seller, sid, nowIso, menuOps, handover, loadState, readSets, readPastWeeks } = c;
  const [s, sets, live, past, archived, pastRows, view, places, dishes, links, prefs, log] =
    await Promise.all([
      loadState(),
      readSets(),
      readOrders(db, sid, LIVE_MENU),
      readPastWeeks(),
      readOrders(db, sid, 'o.past_week_id IS NOT NULL'),
      db.all<{ id: string; past_week_id: string }>(
        'SELECT id, past_week_id FROM orders WHERE seller_id = ? AND past_week_id IS NOT NULL',
        sid,
      ),
      menuOps.getCurrentMenu(),
      menuOps.listPickupPlaces(),
      menuOps.listDishes(),
      db.all<{ id: string; dish_id: string | null }>(
        'SELECT id, dish_id FROM menu_items WHERE seller_id = ?',
        sid,
      ),
      menuOps.getPreferences(),
      handover.listMessages(),
    ]);
  const weekOfOrder = new Map(pastRows.map((row) => [row.id, row.past_week_id]));
  const itemDishIds: Record<string, string> = {};
  for (const link of links) if (link.dish_id !== null) itemDishIds[link.id] = link.dish_id;
  return structuredClone({
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    seller: { slug: seller.slug, name: seller.name },
    kitchen: s.kitchen,
    settings: s.settings,
    week: s.week,
    items: s.items,
    chefs: s.chefs,
    sets: sets.map(({ id, name, items, images }): SavedSet => ({ id, name, items, images })),
    menu: view.menu,
    pickupPlaces: places,
    dishes,
    itemDishIds,
    dishSets: sets.map(({ id, name, dishIds, timesUsed }) => ({
      id,
      name,
      dishIds,
      timesUsed,
    })),
    preferences: prefs,
    ...(log.length > 0 ? { messageLog: log } : {}),
    orders: live,
    pastWeeks: past.map(({ hasOrders, ...rest }): PastWeek => {
      if (!hasOrders) return rest;
      return {
        ...rest,
        orders: archived.filter((order) => weekOfOrder.get(order.id) === rest.id),
      };
    }),
  });
}
