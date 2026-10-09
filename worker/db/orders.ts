// Reading and writing orders with their lines, audit trail and customer inbox. Every function takes
// the seller id and filters by it (D-036).
import type { AuditEntry, InboxEntry, SellerOrder } from '../../shared/domain';
import { Db, type D1Statement } from './d1';
import { ordersOf, type AuditRow, type InboxRow, type LineRow, type OrderRow } from './rows';

/**
 * The four reads behind a set of orders (orders, lines, audit, inbox) for a filter over the alias
 * `o`. `assembleOrders` turns their results into orders, so a caller can send them together with
 * other reads in one round trip.
 */
export function orderReadStatements(
  db: Db,
  filter: string,
  args: Array<string | number | null>,
): Array<D1Statement> {
  const join = (table: string, alias: string) =>
    `FROM ${table} ${alias} JOIN orders o ON o.seller_id = ${alias}.seller_id AND o.id = ${alias}.order_id`;
  return [
    db.stmt(`SELECT o.* FROM orders o WHERE ${filter} ORDER BY o.rowid`, ...args),
    db.stmt(
      `SELECT l.* ${join('order_lines', 'l')} WHERE ${filter} ORDER BY l.order_id, l.position`,
      ...args,
    ),
    db.stmt(
      `SELECT a.* ${join('order_audit', 'a')} WHERE ${filter} ORDER BY a.order_id, a.seq DESC`,
      ...args,
    ),
    db.stmt(
      `SELECT i.* ${join('order_inbox', 'i')} WHERE ${filter} ORDER BY i.order_id, i.seq DESC`,
      ...args,
    ),
  ];
}

export function assembleOrders(results: ReadonlyArray<Array<unknown>>): Array<SellerOrder> {
  const [orders, lines, audit, inbox] = results;
  return ordersOf(
    (orders ?? []) as Array<OrderRow>,
    (lines ?? []) as Array<LineRow>,
    (audit ?? []) as Array<AuditRow>,
    (inbox ?? []) as Array<InboxRow>,
  );
}

/**
 * Orders of one seller, oldest first (insertion order), with lines, audit and inbox. `where` is
 * SQL over the alias `o` (for example `o.past_week_id IS NULL`), with its bound `params`.
 */
export async function readOrders(
  db: Db,
  sellerId: string,
  where: string,
  ...params: Array<string | number | null>
): Promise<Array<SellerOrder>> {
  const statements = orderReadStatements(db, `o.seller_id = ? AND (${where})`, [
    sellerId,
    ...params,
  ]);
  return assembleOrders(await db.batch(statements));
}

export async function readLiveOrder(
  db: Db,
  sellerId: string,
  column: 'code' | 'token',
  value: string,
): Promise<SellerOrder | undefined> {
  const [order] = await readOrders(
    db,
    sellerId,
    `o.past_week_id IS NULL AND o.${column} = ?`,
    value,
  );
  return order;
}

// ---- Writes ----

const AUDIT_SQL = `INSERT INTO order_audit (seller_id, order_id, seq, by_role, by_name, what, detail, diff_json, at)
  SELECT ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ?, ?, ? FROM order_audit WHERE seller_id = ? AND order_id = ?`;

const INBOX_SQL = `INSERT INTO order_inbox (seller_id, order_id, seq, at, kind, status, text_key, text, minutes)
  SELECT ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ?, ?, ? FROM order_inbox WHERE seller_id = ? AND order_id = ?`;

/** Appends one audit entry; `seq` is max + 1 and the trigger keeps the newest 4. */
export function auditStatement(
  db: Db,
  sellerId: string,
  orderId: string,
  entry: AuditEntry,
): D1Statement {
  return db.stmt(
    AUDIT_SQL,
    sellerId,
    orderId,
    entry.by.role,
    entry.by.name,
    entry.what,
    entry.detail ?? null,
    entry.diff ? JSON.stringify(entry.diff) : null,
    entry.at,
    sellerId,
    orderId,
  );
}

/** Appends one inbox entry; `seq` is max + 1 and the trigger keeps the newest 20. */
export function inboxStatement(
  db: Db,
  sellerId: string,
  orderId: string,
  entry: InboxEntry,
): D1Statement {
  return db.stmt(
    INBOX_SQL,
    sellerId,
    orderId,
    entry.at,
    entry.kind,
    entry.status ?? null,
    entry.textKey ?? null,
    entry.text ?? null,
    entry.minutes ?? null,
    sellerId,
    orderId,
  );
}

function lineStatements(db: Db, order: SellerOrder): Array<D1Statement> {
  return order.lines.map((line, position) =>
    db.stmt(
      `INSERT INTO order_lines (seller_id, order_id, position, item_id, name_en, name_id, size_en, size_id, price_cents, qty, ticked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      order.sellerId,
      order.id,
      position,
      line.itemId,
      line.name.en,
      line.name.id,
      line.size.en,
      line.size.id,
      line.priceCents,
      line.qty,
      line.ticked === true,
    ),
  );
}

/**
 * Inserts a whole order (a new one, or one from a backup). Its audit and inbox arrive newest
 * first and are written oldest first, so the caps in the triggers keep the newest.
 */
export function insertOrderStatements(
  db: Db,
  order: SellerOrder,
  pastWeekId: string | null,
): Array<D1Statement> {
  const sellerId = order.sellerId;
  const statements = [
    db.stmt(
      `INSERT INTO orders (seller_id, id, code, token, past_week_id, first_name, language, fulfilment, note, status,
         paid, locked, wa_received, is_returning, changed, entered_by_role, entered_by_name, created_at, updated_at,
         packed, collected_at, collected_by, pickup_place_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sellerId,
      order.id,
      order.code,
      order.token,
      pastWeekId,
      order.firstName,
      order.language,
      order.fulfilment,
      order.note ?? null,
      order.status,
      order.paid,
      order.locked,
      order.waReceived,
      order.returning,
      order.changed,
      order.enteredBy?.role ?? null,
      order.enteredBy?.name ?? null,
      order.createdAt,
      order.updatedAt,
      order.packed === true,
      order.collectedAt ?? null,
      order.collectedBy ?? null,
      order.pickupPlaceId ?? null,
    ),
    ...lineStatements(db, order),
  ];
  for (const entry of [...order.audit].reverse()) {
    statements.push(auditStatement(db, sellerId, order.id, entry));
  }
  for (const entry of [...order.inbox].reverse()) {
    statements.push(inboxStatement(db, sellerId, order.id, entry));
  }
  return statements;
}

/** What one operation did to an order: its new state, and the entries it added (oldest first). */
export type OrderChange = {
  order: SellerOrder;
  linesChanged: boolean;
  audits: Array<AuditEntry>;
  inboxes: Array<InboxEntry>;
};

export function changeStatements(db: Db, change: OrderChange): Array<D1Statement> {
  const { order } = change;
  const sellerId = order.sellerId;
  const statements = [
    db.stmt(
      // `packed` and the ticks are not written here: only the pack call changes them (D-066), so a
      // status change read a moment earlier can never undo a tick.
      `UPDATE orders SET status = ?, paid = ?, locked = ?, wa_received = ?, changed = ?, fulfilment = ?,
         note = ?, collected_at = ?, collected_by = ?, updated_at = ? WHERE seller_id = ? AND id = ?`,
      order.status,
      order.paid,
      order.locked,
      order.waReceived,
      order.changed,
      order.fulfilment,
      order.note ?? null,
      order.collectedAt ?? null,
      order.collectedBy ?? null,
      order.updatedAt,
      sellerId,
      order.id,
    ),
  ];
  if (change.linesChanged) {
    statements.push(
      db.stmt('DELETE FROM order_lines WHERE seller_id = ? AND order_id = ?', sellerId, order.id),
      ...lineStatements(db, order),
    );
  }
  for (const entry of change.audits) statements.push(auditStatement(db, sellerId, order.id, entry));
  for (const entry of change.inboxes) {
    statements.push(inboxStatement(db, sellerId, order.id, entry));
  }
  return statements;
}
