// Selling on the day (plan 029 stage 2): the atomic day stock and the sales log. Every query
// filters by `seller_id` (D-036). Pre-orders never touch `day_stock`. A sale is one D1 batch (one
// transaction): the log row is inserted from the same condition as the stock update, so two helpers
// cannot both sell the last portion and the log always adds up to the stock.
import type { DaySaleEntry, DaySaleKind } from '../../shared/daySalesContract';
import { DAY_SALES_KEEP_WEEKS, DAY_UNDO_WINDOW_MS } from '../../shared/daySalesContract';
import type { SellerRepository, StoreResult } from '../repo/Repository';
import type { Db } from './d1';
import type { MenuDeps } from './menus';

export type DayOps = Pick<
  SellerRepository,
  'sellOnDay' | 'setDayCount' | 'undoDaySale' | 'listDaySales'
>;

type LogRow = {
  id: string;
  menu_id: string;
  item_id: string;
  kind: DaySaleKind;
  change: number;
  stock_after: number;
  by_name: string;
  at: string;
  undone: number;
};

function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

const COLUMNS =
  'id, seller_id, menu_id, item_id, kind, change, stock_after, by_account, by_name, at';

export function createDayOps(deps: MenuDeps, sid: string): DayOps {
  const { db } = deps;

  /** The item's day stock (null = not sold on the day), or undefined when there is no such item. */
  async function stockOf(itemId: string): Promise<number | null | undefined> {
    const row = await db.first<{ day_stock: number | null }>(
      'SELECT day_stock FROM menu_items WHERE seller_id = ? AND id = ?',
      sid,
      itemId,
    );
    return row ? row.day_stock : undefined;
  }

  async function menuId(): Promise<string> {
    const row = await db.first<{ id: string }>('SELECT id FROM menus WHERE seller_id = ?', sid);
    if (!row) throw new Error(`Seller ${sid} has no menu`);
    return row.id;
  }

  return {
    async sellOnDay(request, by) {
      const before = await stockOf(request.itemId);
      if (before === undefined)
        return { ok: false, error: 'unknown_item', message: 'Unknown item' };
      if (before === null) {
        return { ok: false, error: 'invalid_request', message: 'Not sold on the day' };
      }
      const at = deps.now().toISOString();
      const saleId = deps.newId();
      // Both statements carry the same `day_stock >= qty` condition and run in one transaction: the
      // log row is written exactly when the stock moves (RETURNING says whether it did).
      const [logged] = await db.batch([
        db.stmt(
          `INSERT INTO day_sales (${COLUMNS})
           SELECT ?, seller_id, ?, id, 'sale', ?, day_stock - ?, ?, ?, ?
           FROM menu_items WHERE seller_id = ? AND id = ? AND day_stock >= ?
           RETURNING id, stock_after`,
          saleId,
          await menuId(),
          -request.qty,
          request.qty,
          by.accountId ?? null,
          by.name,
          at,
          sid,
          request.itemId,
          request.qty,
        ),
        db.stmt(
          'UPDATE menu_items SET day_stock = day_stock - ? WHERE seller_id = ? AND id = ? AND day_stock >= ?',
          request.qty,
          sid,
          request.itemId,
          request.qty,
        ),
      ]);
      const row = logged?.[0] as { stock_after: number } | undefined;
      if (!row) return { ok: false, error: 'sold_out', message: 'Sold out' };
      return ok({ itemId: request.itemId, dayStock: row.stock_after, entryId: saleId });
    },

    async setDayCount(request, by) {
      const before = await stockOf(request.itemId);
      if (before === undefined)
        return { ok: false, error: 'unknown_item', message: 'Unknown item' };
      const at = deps.now().toISOString();
      // The difference is worked out inside the transaction, from the stock it really replaces.
      await db.batch([
        db.stmt(
          `INSERT INTO day_sales (${COLUMNS})
           SELECT ?, seller_id, ?, id, 'count', ? - COALESCE(day_stock, 0), ?, ?, ?, ?
           FROM menu_items WHERE seller_id = ? AND id = ? AND (day_stock IS NULL OR day_stock <> ?)`,
          deps.newId(),
          await menuId(),
          request.count,
          request.count,
          by.accountId ?? null,
          by.name,
          at,
          sid,
          request.itemId,
          request.count,
        ),
        db.stmt(
          'UPDATE menu_items SET day_stock = ? WHERE seller_id = ? AND id = ?',
          request.count,
          sid,
          request.itemId,
        ),
      ]);
      return ok({ itemId: request.itemId, dayStock: request.count });
    },

    async undoDaySale(request, by) {
      const sale = await db.first<{
        item_id: string;
        kind: DaySaleKind;
        undone: number;
        by_account: string | null;
        at: string;
      }>(
        'SELECT item_id, kind, undone, by_account, at FROM day_sales WHERE seller_id = ? AND id = ?',
        sid,
        request.entryId,
      );
      if (!sale || sale.kind !== 'sale') {
        return { ok: false, error: 'not_found', message: 'Sale not found' };
      }
      if (sale.undone === 1) {
        return { ok: false, error: 'invalid_request', message: 'Already undone' };
      }
      const now = deps.now();
      if (
        by.owner !== true &&
        (sale.by_account === null ||
          sale.by_account !== (by.accountId ?? null) ||
          now.getTime() - Date.parse(sale.at) > DAY_UNDO_WINDOW_MS)
      ) {
        return { ok: false, error: 'forbidden', message: 'Only the owner can undo this sale now' };
      }
      const undoId = deps.newId();
      // The undo row is written only for a sale of this menu that is not yet undone (the unique
      // index on undoes backs that up); the stock and the sale's flag change only if it was.
      const [logged] = await db.batch([
        db.stmt(
          `INSERT INTO day_sales (${COLUMNS}, undoes)
           SELECT ?, s.seller_id, s.menu_id, s.item_id, 'undo', -s.change, m.day_stock - s.change, ?, ?, ?, s.id
           FROM day_sales s JOIN menu_items m ON m.seller_id = s.seller_id AND m.id = s.item_id
           WHERE s.seller_id = ? AND s.id = ? AND s.kind = 'sale' AND s.undone = 0
             AND s.menu_id = (SELECT id FROM menus WHERE seller_id = s.seller_id)
           RETURNING stock_after`,
          undoId,
          by.accountId ?? null,
          by.name,
          now.toISOString(),
          sid,
          request.entryId,
        ),
        db.stmt(
          `UPDATE menu_items SET day_stock = day_stock + (SELECT -change FROM day_sales WHERE id = ?)
           WHERE seller_id = ? AND id = ? AND EXISTS (SELECT 1 FROM day_sales WHERE id = ?)`,
          request.entryId,
          sid,
          sale.item_id,
          undoId,
        ),
        db.stmt(
          'UPDATE day_sales SET undone = 1 WHERE seller_id = ? AND id = ? AND EXISTS (SELECT 1 FROM day_sales WHERE id = ?)',
          sid,
          request.entryId,
          undoId,
        ),
      ]);
      const row = logged?.[0] as { stock_after: number } | undefined;
      if (!row) return { ok: false, error: 'invalid_request', message: 'Cannot undo this sale' };
      return ok({ itemId: sale.item_id, dayStock: row.stock_after, entryId: undoId });
    },

    async listDaySales() {
      const rows = await db.all<LogRow>(
        `SELECT * FROM day_sales WHERE seller_id = ?
           AND menu_id = (SELECT id FROM menus WHERE seller_id = ?) ORDER BY at DESC, rowid DESC`,
        sid,
        sid,
      );
      return rows.map((row): DaySaleEntry => ({
        id: row.id,
        menuId: row.menu_id,
        itemId: row.item_id,
        kind: row.kind,
        change: row.change,
        stockAfter: row.stock_after,
        by: row.by_name,
        at: row.at,
        undone: row.undone === 1,
      }));
    },
  };
}

/** The weekly clean-up: log rows older than 10 weeks go, for every kitchen. Returns how many. */
export async function dropOldDaySales(db: Db, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - DAY_SALES_KEEP_WEEKS * 7 * 86_400_000).toISOString();
  const old = await db.first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM day_sales WHERE at < ?',
    cutoff,
  );
  if (!old?.n) return 0;
  await db.stmt('DELETE FROM day_sales WHERE at < ?', cutoff).run();
  return old.n;
}
