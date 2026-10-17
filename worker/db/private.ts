// Plan 081: private (Khusus) orders. They are rows of `orders` with kind 'private', an event date and
// time (kitchen-local, D-101) and an optional deposit; they never get a past_week_id, so no menu query
// (stock, portion guard, finish, lists, CSV, backup; see LIVE_MENU) ever sees them. Every function
// filters by the seller id (D-036). Only the owner writes (the routes gate that).
import type { ApiErrorCode } from '../../shared/apiError';
import type {
  AuditEntry,
  InboxEntry,
  OrderLine,
  SellerOrder,
  StaffActor,
} from '../../shared/domain';
import { AUDIT_MAX, INBOX_MAX, ORDER_DETAIL_WEEKS } from '../../shared/limits';
import { diffOrder } from '../../shared/auditDiff';
import { isFinalStatus } from '../../shared/status';
import type {
  CreatePrivateRequest,
  PrivateChefRow,
  PrivateChefSummaryResponse,
  PrivateDue,
  PrivateLineInput,
  PrivateListResponse,
  UpdatePrivateRequest,
} from '../../shared/privateContract';
import { DEFAULT_ZONE, splitInstant } from '../../shared/zone';
import type { StoreResult } from '../repo/Repository';
import { Db, type D1Statement } from './d1';
import {
  changeStatements,
  insertOrderStatements,
  readLiveOrder,
  readOrders,
  type OrderChange,
} from './orders';
import type { CustomerNotice } from './menus';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PrivateDeps = {
  db: Db;
  now: () => Date;
  newId: () => string;
  newCode: () => string;
  newToken: () => string;
  /** Web push after a write that told the customer something (the same hook as menu orders). */
  notify?: (notices: Array<CustomerNotice>) => void;
};

/** The days between two YYYY-MM-DD dates are added in UTC (no time of day involved). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The kitchen-local date of an instant in a zone. */
export function localDate(now: Date, zone: string): string {
  return splitInstant(now.toISOString(), zone).date;
}

/**
 * D-099 for a private order: its address goes once the kitchen-local date is later than the event
 * date plus one day (the event on the 10th: gone from the 12th, 00:00 on).
 */
export function privateAddressExpired(eventDate: string, zone: string, now: Date): boolean {
  return localDate(now, zone) > addDays(eventDate, 1);
}

function fail<T>(error: ApiErrorCode, message: string): StoreResult<T> {
  return { ok: false, error, message };
}

function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

type DishRow = {
  id: string;
  name_en: string;
  name_id: string;
  size_en: string;
  size_id: string;
  price_cents: number;
  chef_id: string | null;
};

export type PrivateOps = ReturnType<typeof createPrivateOps>;

export function createPrivateOps(deps: PrivateDeps, sid: string) {
  const { db } = deps;
  const nowIso = () => deps.now().toISOString();

  async function zone(): Promise<string> {
    const row = await db.first<{ time_zone: string }>(
      'SELECT time_zone FROM kitchens WHERE seller_id = ?',
      sid,
    );
    return row?.time_zone ?? DEFAULT_ZONE;
  }

  /** Library dishes copied onto lines (D-062): name, size and price as now, per-order qty and price. */
  async function buildLines(
    inputs: ReadonlyArray<PrivateLineInput>,
    existing: ReadonlyArray<OrderLine> = [],
  ): Promise<StoreResult<Array<OrderLine>>> {
    const ids = inputs.map((line) => line.dishId);
    const rows = await db.all<DishRow>(
      `SELECT id, name_en, name_id, size_en, size_id, price_cents, chef_id FROM dishes
       WHERE seller_id = ? AND id IN (${ids.map(() => '?').join(', ')})`,
      sid,
      ...ids,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    const lines: Array<OrderLine> = [];
    for (const input of inputs) {
      const dish = byId.get(input.dishId);
      if (!dish) return fail('unknown_item', `Unknown dish: ${input.dishId}`);
      const ticked = existing.find((line) => line.itemId === dish.id)?.ticked === true;
      lines.push({
        itemId: dish.id,
        name: { en: dish.name_en, id: dish.name_id },
        size: { en: dish.size_en, id: dish.size_id },
        priceCents: input.priceCents ?? dish.price_cents,
        qty: input.qty,
        ...(dish.chef_id !== null ? { chefId: dish.chef_id } : {}),
        ...(ticked ? { ticked: true } : {}),
      });
    }
    return ok(lines);
  }

  async function knownPlace(placeId: string): Promise<boolean> {
    return (
      (await db.first(
        'SELECT 1 AS hit FROM pickup_places WHERE seller_id = ? AND id = ?',
        sid,
        placeId,
      )) !== null
    );
  }

  async function uniqueCode(): Promise<string> {
    let code = deps.newCode();
    while (
      await db.first('SELECT 1 AS hit FROM orders WHERE seller_id = ? AND code = ?', sid, code)
    ) {
      code = deps.newCode();
    }
    return code;
  }

  async function create(
    input: CreatePrivateRequest,
    actor: StaffActor,
  ): Promise<StoreResult<SellerOrder>> {
    const fulfilment = input.fulfilment ?? 'delivery';
    if (fulfilment === 'pickup' && input.pickupPlaceId !== undefined) {
      if (!(await knownPlace(input.pickupPlaceId)))
        return fail('invalid_request', 'Unknown pickup place');
    }
    const lines = await buildLines(input.lines);
    if (!lines.ok) return lines;
    if (
      input.depositCents !== undefined &&
      input.depositCents > lines.value.reduce((sum, l) => sum + l.priceCents * l.qty, 0)
    )
      return fail('invalid_request', 'The deposit is more than the total');
    const at = nowIso();
    const order: SellerOrder = {
      id: deps.newId(),
      sellerId: sid,
      code: await uniqueCode(),
      token: deps.newToken(),
      firstName: input.firstName,
      language: input.language,
      lines: lines.value,
      fulfilment,
      ...(input.note !== undefined ? { note: input.note } : {}),
      status: 'confirmed',
      paid: input.paid ?? false,
      locked: false,
      waReceived: false,
      returning: false,
      changed: false,
      inbox: [{ at, kind: 'status', status: 'confirmed' }],
      enteredBy: actor,
      audit: [{ by: actor, what: 'created', at }],
      ...(fulfilment === 'pickup' && input.pickupPlaceId !== undefined
        ? { pickupPlaceId: input.pickupPlaceId }
        : {}),
      private: {
        eventDate: input.eventDate,
        ...(input.eventTime !== undefined ? { eventTime: input.eventTime } : {}),
        ...(input.depositCents !== undefined ? { depositCents: input.depositCents } : {}),
      },
      createdAt: at,
      updatedAt: at,
    };
    await db.batch(insertOrderStatements(db, order, null));
    return ok(order);
  }

  async function readPrivate(code: string): Promise<SellerOrder | undefined> {
    const order = await readLiveOrder(db, sid, 'code', code);
    return order?.private ? order : undefined;
  }

  async function update(
    code: string,
    patch: UpdatePrivateRequest,
    actor: StaffActor,
  ): Promise<StoreResult<SellerOrder>> {
    const order = await readPrivate(code);
    if (!order) return fail('not_found', 'Order not found');
    if (order.status === 'cancelled') return fail('invalid_status', 'This order is cancelled');
    let lines = order.lines;
    if (patch.lines) {
      const built = await buildLines(patch.lines, order.lines);
      if (!built.ok) return built;
      lines = built.value;
    }
    const fulfilment = patch.fulfilment ?? order.fulfilment;
    if (fulfilment === 'pickup' && patch.pickupPlaceId) {
      if (!(await knownPlace(patch.pickupPlaceId)))
        return fail('invalid_request', 'Unknown pickup place');
    }
    const info = order.private as NonNullable<SellerOrder['private']>;
    const eventTime =
      patch.eventTime === undefined ? info.eventTime : (patch.eventTime ?? undefined);
    const deposit =
      patch.depositCents === undefined ? info.depositCents : (patch.depositCents ?? undefined);
    if (deposit !== undefined && deposit > lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0))
      return fail('invalid_request', 'The deposit is more than the total');
    const pickup =
      fulfilment === 'delivery'
        ? undefined
        : patch.pickupPlaceId === undefined
          ? order.pickupPlaceId
          : (patch.pickupPlaceId ?? undefined);
    const at = nowIso();
    const next: SellerOrder = {
      ...order,
      firstName: patch.firstName ?? order.firstName,
      language: patch.language ?? order.language,
      lines,
      fulfilment,
      paid: patch.paid ?? order.paid,
      private: {
        eventDate: patch.eventDate ?? info.eventDate,
        ...(eventTime !== undefined ? { eventTime } : {}),
        ...(deposit !== undefined ? { depositCents: deposit } : {}),
      },
      updatedAt: at,
    };
    delete next.pickupPlaceId;
    if (pickup !== undefined) next.pickupPlaceId = pickup;
    if (patch.note !== undefined) {
      if (patch.note === '') delete next.note;
      else next.note = patch.note;
    }
    const audits: Array<{
      what: 'edited' | 'paid';
      detail?: string;
      diff?: ReturnType<typeof diffOrder>;
    }> = [];
    const diff = diffOrder(order, next);
    const others =
      patch.firstName !== undefined ||
      patch.language !== undefined ||
      patch.eventDate !== undefined ||
      patch.eventTime !== undefined ||
      patch.depositCents !== undefined ||
      patch.pickupPlaceId !== undefined ||
      patch.address !== undefined;
    if (diff || others) audits.push({ what: 'edited', ...(diff ? { diff } : {}) });
    if (next.paid !== order.paid) {
      audits.push({ what: 'paid', detail: next.paid ? 'paid' : 'unpaid' });
    }
    const entries = audits.map((entry): AuditEntry => ({
      by: actor,
      what: entry.what,
      ...(entry.detail !== undefined ? { detail: entry.detail } : {}),
      ...(entry.diff ? { diff: entry.diff } : {}),
      at,
    }));
    next.audit = [...entries].reverse().concat(order.audit).slice(0, AUDIT_MAX);
    const change: OrderChange = {
      order: next,
      linesChanged: patch.lines !== undefined,
      audits: entries,
      inboxes: [],
    };
    const extra: D1Statement = db.stmt(
      `UPDATE orders SET first_name = ?, language = ?, pickup_place_id = ?, event_date = ?, event_time = ?,
         deposit_cents = ?, address_enc = CASE WHEN ? = 'pickup' THEN NULL ELSE address_enc END
       WHERE seller_id = ? AND id = ?`,
      next.firstName,
      next.language,
      next.pickupPlaceId ?? null,
      next.private?.eventDate ?? null,
      next.private?.eventTime ?? null,
      next.private?.depositCents ?? null,
      next.fulfilment,
      sid,
      order.id,
    );
    await db.batch([...changeStatements(db, change), extra]);
    return ok(next);
  }

  /** Status cancelled, the address cleared, the customer told; push subscriptions go. */
  async function cancel(code: string, actor: StaffActor): Promise<StoreResult<SellerOrder>> {
    const order = await readPrivate(code);
    if (!order) return fail('not_found', 'Order not found');
    if (order.status === 'cancelled') return ok(order);
    if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
    const at = nowIso();
    const entry: InboxEntry = { at, kind: 'status', status: 'cancelled' };
    const audit = { by: actor, what: 'status' as const, detail: 'cancelled', at };
    const next: SellerOrder = {
      ...order,
      status: 'cancelled',
      changed: false,
      inbox: [entry, ...order.inbox].slice(0, INBOX_MAX),
      audit: [audit, ...order.audit].slice(0, AUDIT_MAX),
      updatedAt: at,
    };
    await db.batch([
      ...changeStatements(db, {
        order: next,
        linesChanged: false,
        audits: [audit],
        inboxes: [entry],
      }),
      db.stmt('UPDATE orders SET address_enc = NULL WHERE seller_id = ? AND id = ?', sid, order.id),
      db.stmt('DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id = ?', sid, order.id),
    ]);
    deps.notify?.([{ order: next, entries: [entry] }]);
    return ok(next);
  }

  const byEvent = (a: SellerOrder, b: SellerOrder): number =>
    (a.private?.eventDate ?? '').localeCompare(b.private?.eventDate ?? '') ||
    (a.private?.eventTime ?? '').localeCompare(b.private?.eventTime ?? '') ||
    a.createdAt.localeCompare(b.createdAt);

  async function dueCounts(today: string): Promise<PrivateDue> {
    const tomorrow = addDays(today, 1);
    const rows = await db.all<{ event_date: string; n: number }>(
      `SELECT event_date, COUNT(*) AS n FROM orders
       WHERE seller_id = ? AND kind = 'private' AND status NOT IN ('cancelled', 'delivered', 'collected') AND event_date IN (?, ?)
       GROUP BY event_date`,
      sid,
      today,
      tomorrow,
    );
    const count = (date: string) => rows.find((row) => row.event_date === date)?.n ?? 0;
    return { today: count(today), tomorrow: count(tomorrow) };
  }

  async function list(
    options: { view?: 'upcoming' | 'past'; day?: 'today'; dueOnly?: boolean } = {},
  ): Promise<PrivateListResponse> {
    const today = localDate(deps.now(), await zone());
    const due = await dueCounts(today);
    if (options.dueOnly) return { orders: [], due, today };
    let orders: Array<SellerOrder>;
    if (options.day === 'today') {
      orders = (
        await readOrders(
          db,
          sid,
          "o.kind = 'private' AND o.event_date = ? AND o.status <> 'cancelled'",
          today,
        )
      ).sort(byEvent);
    } else if (options.view === 'past') {
      orders = (
        await readOrders(
          db,
          sid,
          "o.kind = 'private' AND (o.event_date < ? OR o.status = 'cancelled')",
          today,
        )
      )
        .sort(byEvent)
        .reverse();
    } else {
      orders = (
        await readOrders(
          db,
          sid,
          "o.kind = 'private' AND o.event_date >= ? AND o.status <> 'cancelled'",
          today,
        )
      ).sort(byEvent);
    }
    return { orders, due, today };
  }

  /** Per chef: portions and money of the day's private orders (cancelled excluded). */
  async function chefSummary(
    date: string,
    asChefId?: string,
  ): Promise<PrivateChefSummaryResponse | 'private'> {
    // Same rule as the menu's per-chef income (plan 069): a chef only while the setting is on.
    if (asChefId !== undefined) {
      const setting = await db.first<{ chefs_see_income: number }>(
        'SELECT chefs_see_income FROM kitchen_settings WHERE seller_id = ?',
        sid,
      );
      if (setting?.chefs_see_income === 0) return 'private';
    }
    const rows = await db.all<{
      chef_id: string | null;
      name: string | null;
      qty: number;
      cents: number;
    }>(
      `SELECT l.chef_id AS chef_id, c.name AS name, SUM(l.qty) AS qty, SUM(l.qty * l.price_cents) AS cents
       FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
       LEFT JOIN chefs c ON c.seller_id = l.seller_id AND c.id = l.chef_id
       WHERE o.seller_id = ? AND o.kind = 'private' AND o.event_date = ? AND o.status <> 'cancelled'
       GROUP BY l.chef_id, c.name ORDER BY cents DESC`,
      sid,
      date,
    );
    return {
      date,
      rows: rows
        .filter((row) => asChefId === undefined || row.chef_id === asChefId)
        .map((row): PrivateChefRow => ({
          chefId: row.chef_id,
          ...(row.name !== null ? { chefName: row.name } : {}),
          qty: row.qty,
          cents: row.cents,
        })),
    };
  }

  return {
    createPrivate: create,
    updatePrivate: update,
    cancelPrivate: cancel,
    listPrivate: list,
    privateChefSummary: chefSummary,
    getPrivate: readPrivate,
  };
}

// ---- Retention (called from the address sweep and the retention job) ----

type Pair = { seller_id: string; id: string };

function pairGroup(group: ReadonlyArray<Pair>, column: string): string {
  return group.map(() => `(seller_id = ? AND ${column} = ?)`).join(' OR ');
}

/** Hourly: wipes the address of every private order whose event is over (see privateAddressExpired). */
export async function wipePrivateAddresses(db: Db, now: Date): Promise<number> {
  const rows = await db.all<Pair & { event_date: string; time_zone: string }>(
    `SELECT o.seller_id AS seller_id, o.id AS id, o.event_date AS event_date, k.time_zone AS time_zone
     FROM orders o JOIN kitchens k ON k.seller_id = o.seller_id
     WHERE o.kind = 'private' AND o.address_enc IS NOT NULL AND o.event_date IS NOT NULL`,
  );
  const expired = rows.filter((row) => privateAddressExpired(row.event_date, row.time_zone, now));
  for (let from = 0; from < expired.length; from += 30) {
    const group = expired.slice(from, from + 30);
    await db.batch([
      db.stmt(
        `UPDATE orders SET address_enc = NULL WHERE ${pairGroup(group, 'id')}`,
        ...group.flatMap((row) => [row.seller_id, row.id]),
      ),
    ]);
  }
  return expired.length;
}

/**
 * Deletes private orders ORDER_DETAIL_WEEKS after their event date, leaving the "archived" stub
 * (cooking_date = the event date). For one seller or all of them. Returns how many went.
 */
export async function dropExpiredPrivate(db: Db, now: Date, sellerId?: string): Promise<number> {
  // A day of slack on the SQL side; the exact rule (UTC date plus 4 weeks) is the JS filter below.
  const before = addDays(now.toISOString().slice(0, 10), -(ORDER_DETAIL_WEEKS * 7 + 1));
  const rows = await db.all<Pair & { event_date: string }>(
    `SELECT seller_id, id, event_date FROM orders
     WHERE kind = 'private' AND event_date IS NOT NULL AND event_date <= ?${sellerId === undefined ? '' : ' AND seller_id = ?'}`,
    before,
    ...(sellerId === undefined ? [] : [sellerId]),
  );
  const expired = rows.filter(
    (row) =>
      now.getTime() >= Date.parse(`${row.event_date}T00:00:00Z`) + ORDER_DETAIL_WEEKS * 7 * DAY_MS,
  );
  for (let from = 0; from < expired.length; from += 30) {
    const group = expired.slice(from, from + 30);
    const args = group.flatMap((row) => [row.seller_id, row.id]);
    await db.batch([
      db.stmt(
        `INSERT OR IGNORE INTO expired_orders (token, seller_id, cooking_date)
         SELECT token, seller_id, event_date FROM orders WHERE kind = 'private' AND (${pairGroup(group, 'id')})`,
        ...args,
      ),
      db.stmt(`DELETE FROM push_subscriptions WHERE ${pairGroup(group, 'order_id')}`, ...args),
      db.stmt(`DELETE FROM orders WHERE kind = 'private' AND (${pairGroup(group, 'id')})`, ...args),
    ]);
  }
  return expired.length;
}
