// Packing, messages to a pickup place, delivery steps and "collected" (plan 001, stage 4). Every
// query filters by `seller_id` (D-036). D-062: a call that would warn returns a failure carrying a
// `warning` and writes nothing; with `force` it goes ahead. D-059: nothing here takes or stores a
// phone number or an address; the log holds a group, a type, minutes, the seller's own text and a
// count.
import type { ApiErrorCode, ApiWarning } from '../../shared/apiError';
import type {
  AuditEntry,
  CollectedBy,
  InboxEntry,
  OrderStatus,
  SellerOrder,
  StaffActor,
} from '../../shared/domain';
import {
  REPEAT_WINDOW_MINUTES,
  type DeliveryStep,
  type MessageLogEntry,
  type MessageText,
  type MessageType,
} from '../../shared/handoverContract';
import { AUDIT_MAX, INBOX_MAX } from '../../shared/limits';
import { isFinalStatus } from '../../shared/status';
import type { SellerRepository, StoreResult } from '../repo/Repository';
import { marks, type D1Statement } from './d1';
import type { MenuDeps } from './menus';
import { changeStatements, readLiveOrder, readOrders, type OrderChange } from './orders';

export type HandoverOps = Pick<
  SellerRepository,
  | 'packOrder'
  | 'listMessages'
  | 'messagePlace'
  | 'deliveryStep'
  | 'markCollected'
  | 'customerCollected'
>;

function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}
function fail<T>(error: ApiErrorCode, message: string): StoreResult<T> {
  return { ok: false, error, message };
}
/** A refusal the seller may override: `error` is what the call used to refuse with. */
function warn<T>(error: ApiErrorCode, warning: ApiWarning, message: string): StoreResult<T> {
  return { ok: false, error, message, warning };
}

type LogRow = {
  id: string;
  menu_id: string;
  group_key: string;
  type: MessageType;
  minutes: number | null;
  text_en: string | null;
  text_id: string | null;
  at: string;
  sent_count: number;
};

function entryOf(row: LogRow): MessageLogEntry {
  const text: MessageText = {};
  if (row.text_en !== null) text.en = row.text_en;
  if (row.text_id !== null) text.id = row.text_id;
  return {
    id: row.id,
    menuId: row.menu_id,
    group: row.group_key,
    type: row.type,
    ...(row.minutes !== null ? { minutes: row.minutes } : {}),
    ...(row.text_en !== null || row.text_id !== null ? { text } : {}),
    at: row.at,
    sentCount: row.sent_count,
  };
}

/** About 5 statements an order: 50 orders a batch keeps each batch modest (as sendUpdates does). */
const BATCH_ORDERS = 50;

export function createHandoverOps(deps: MenuDeps, sid: string): HandoverOps {
  const { db } = deps;
  const nowIso = () => deps.now().toISOString();

  /** After the write: lets the Worker push what the customers were just told (never inside the write). */
  const tell = (changes: ReadonlyArray<OrderChange>): void => {
    deps.notify?.(
      changes
        .filter((change) => change.inboxes.length > 0)
        .map((change) => ({ order: change.order, entries: change.inboxes })),
    );
  };

  // ---- Small pure helpers on a draft change ----

  const draft = (order: SellerOrder): OrderChange => ({
    order,
    linesChanged: false,
    audits: [],
    inboxes: [],
  });

  function withInbox(d: OrderChange, entry: Omit<InboxEntry, 'at'>, at: string): OrderChange {
    const full: InboxEntry = { ...entry, at };
    return {
      ...d,
      order: { ...d.order, inbox: [full, ...d.order.inbox].slice(0, INBOX_MAX), updatedAt: at },
      inboxes: [...d.inboxes, full],
    };
  }

  function withAudit(
    d: OrderChange,
    by: AuditEntry['by'],
    detail: string,
    at: string,
  ): OrderChange {
    const full: AuditEntry = { by, what: 'status', detail, at };
    return {
      ...d,
      order: { ...d.order, audit: [full, ...d.order.audit].slice(0, AUDIT_MAX), updatedAt: at },
      audits: [...d.audits, full],
    };
  }

  /** Moves the order to `to`, tells the customer (a status entry) and records who did it. */
  function withStatus(
    d: OrderChange,
    to: OrderStatus,
    by: AuditEntry['by'],
    at: string,
  ): OrderChange {
    const moved: OrderChange = { ...d, order: { ...d.order, status: to, changed: false } };
    return withAudit(withInbox(moved, { kind: 'status', status: to }, at), by, to, at);
  }

  // ---- The log ----

  async function currentMenuId(): Promise<string | undefined> {
    const row = await db.first<{ id: string }>('SELECT id FROM menus WHERE seller_id = ?', sid);
    return row?.id;
  }

  /** True if the same type went to the same group within the repeat window. */
  async function sentRecently(menuId: string, group: string, type: MessageType): Promise<boolean> {
    const since = new Date(deps.now().getTime() - REPEAT_WINDOW_MINUTES * 60_000).toISOString();
    const row = await db.first(
      `SELECT 1 AS hit FROM message_log
       WHERE seller_id = ? AND menu_id = ? AND group_key = ? AND type = ? AND at >= ? LIMIT 1`,
      sid,
      menuId,
      group,
      type,
      since,
    );
    return row !== null;
  }

  /** Insert the entry and drop the rows of any other menu (the log lives with its menu). */
  function logStatements(entry: MessageLogEntry): Array<D1Statement> {
    return [
      db.stmt('DELETE FROM message_log WHERE seller_id = ? AND menu_id <> ?', sid, entry.menuId),
      db.stmt(
        `INSERT INTO message_log (seller_id, id, menu_id, group_key, type, minutes, text_en, text_id, at, sent_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sid,
        entry.id,
        entry.menuId,
        entry.group,
        entry.type,
        entry.minutes ?? null,
        entry.text?.en ?? null,
        entry.text?.id ?? null,
        entry.at,
        entry.sentCount,
      ),
    ];
  }

  function newEntry(
    menuId: string,
    group: string,
    type: MessageType,
    sentCount: number,
    extra: { minutes?: number; text?: MessageText } = {},
  ): MessageLogEntry {
    return {
      id: deps.newId(),
      menuId,
      group,
      type,
      ...(extra.minutes !== undefined ? { minutes: extra.minutes } : {}),
      ...(extra.text !== undefined ? { text: extra.text } : {}),
      at: nowIso(),
      sentCount,
    };
  }

  // ---- Collected (seller and customer share one rule) ----

  function collect(
    order: SellerOrder,
    by: CollectedBy,
    actor: StaffActor | undefined,
    force: boolean,
  ): StoreResult<OrderChange> {
    // Idempotent: the first confirmation stands.
    if (order.collectedAt !== undefined) return ok(draft(order));
    const target: OrderStatus = order.fulfilment === 'pickup' ? 'collected' : 'delivered';
    if (order.status === 'cancelled') {
      if (by === 'customer') return fail('invalid_status', 'This order was cancelled');
      // A forced mark on a cancelled order only records who and when (it is a closed status).
      if (!force) {
        return warn('invalid_status', { code: 'order_cancelled' }, 'This order was cancelled');
      }
    }
    if (by === 'customer' && order.fulfilment !== 'pickup') {
      return fail('invalid_status', 'Only pickup orders can be collected');
    }
    // The customer has no force: only a Ready order can be picked up (a stray tap must not close it).
    if (by === 'customer' && order.status !== 'ready_for_pickup' && order.status !== target) {
      return fail('invalid_status', 'This order is not ready for pickup yet');
    }
    if (by === 'seller' && !force) {
      if (order.fulfilment !== 'pickup') {
        return warn('invalid_status', { code: 'not_pickup' }, 'This is a delivery order');
      }
      if (order.status !== 'ready_for_pickup' && order.status !== target) {
        return warn('confirm_required', { code: 'not_ready' }, 'The order is not ready yet');
      }
    }
    const at = nowIso();
    const marked = draft({ ...order, collectedAt: at, collectedBy: by, updatedAt: at });
    // Already closed some other way (the old hand-over tool): record who and when, nothing more.
    if (isFinalStatus(order.status)) return ok(marked);
    const name = by === 'customer' ? order.firstName : (actor?.name ?? '');
    const who: AuditEntry['by'] =
      by === 'customer' ? { role: 'customer', name } : { role: actor?.role ?? 'seller', name };
    return ok(withStatus(marked, target, who, at));
  }

  async function commitCollect(
    order: SellerOrder | undefined,
    by: CollectedBy,
    actor: StaffActor | undefined,
    force: boolean,
  ): Promise<StoreResult<SellerOrder>> {
    if (!order) return fail('not_found', 'Order not found');
    const change = collect(order, by, actor, force);
    if (!change.ok) return change;
    if (change.value.order.collectedAt === order.collectedAt) return ok(order);
    await db.batch(changeStatements(db, change.value));
    // The customer's own "I've collected it" needs no push; the seller's mark does.
    if (by === 'seller') tell([change.value]);
    return ok(change.value.order);
  }

  // ---- The operations ----

  return {
    async packOrder(code, request) {
      const order = await readLiveOrder(db, sid, 'code', code);
      if (!order) return fail('not_found', 'Order not found');
      const known = new Set(order.lines.map((line) => line.itemId));
      if (request.ticked && !request.ticked.every((id) => known.has(id))) {
        return fail('invalid_request', 'Not an item of this order');
      }
      const ticked = new Set(
        request.ticked ?? order.lines.filter((line) => line.ticked === true).map((l) => l.itemId),
      );
      if (request.packed === true && request.force !== true) {
        const unticked = order.lines.filter((l) => !ticked.has(l.itemId)).map((l) => l.itemId);
        if (unticked.length > 0) {
          return warn(
            'confirm_required',
            { code: 'items_unticked', unticked, count: unticked.length },
            'Some items are not ticked',
          );
        }
      }
      const statements: Array<D1Statement> = [];
      if (request.ticked) {
        const items = [...ticked];
        statements.push(
          items.length === 0
            ? db.stmt(
                'UPDATE order_lines SET ticked = 0 WHERE seller_id = ? AND order_id = ?',
                sid,
                order.id,
              )
            : db.stmt(
                `UPDATE order_lines SET ticked = CASE WHEN item_id IN (${marks(items.length)}) THEN 1 ELSE 0 END
                 WHERE seller_id = ? AND order_id = ?`,
                ...items,
                sid,
                order.id,
              ),
        );
      }
      if (request.packed !== undefined) {
        // Only the flag: no status, no inbox entry, no updated_at (the customer never sees packing).
        statements.push(
          db.stmt(
            'UPDATE orders SET packed = ? WHERE seller_id = ? AND id = ?',
            request.packed,
            sid,
            order.id,
          ),
        );
      }
      await db.batch(statements);
      const next: SellerOrder = {
        ...order,
        lines: order.lines.map((line) => {
          const copy = { ...line };
          if (ticked.has(line.itemId)) copy.ticked = true;
          else delete copy.ticked;
          return copy;
        }),
      };
      const packed = request.packed ?? order.packed === true;
      if (packed) next.packed = true;
      else delete next.packed;
      return ok(next);
    },

    async listMessages() {
      const rows = await db.all<LogRow>(
        `SELECT * FROM message_log WHERE seller_id = ?
           AND menu_id = (SELECT id FROM menus WHERE seller_id = ?) ORDER BY at DESC, rowid DESC`,
        sid,
        sid,
      );
      return rows.map(entryOf);
    },

    async messagePlace(placeId, request, actor) {
      const menuId = await currentMenuId();
      const places = await db.all<{ place_id: string }>(
        'SELECT place_id FROM menu_pickup_places WHERE seller_id = ? ORDER BY position',
        sid,
      );
      if (!menuId || !places.some((place) => place.place_id === placeId)) {
        return fail('not_found', 'Pickup place not found');
      }
      const group = `place:${placeId}`;
      const type: MessageType = request.type;
      if (request.force !== true) {
        if (await sentRecently(menuId, group, type)) {
          return warn(
            'confirm_required',
            { code: 'repeat_message' },
            'The same message went out a few minutes ago',
          );
        }
      }
      // A pickup order with no place counts as the menu's first place.
      const first = places[0]?.place_id;
      const orders = await readOrders(
        db,
        sid,
        "o.past_week_id IS NULL AND o.fulfilment = 'pickup'",
      );
      // A retry after a partial failure: an order the earlier run already readied (a Ready line in
      // its inbox within the repeat window) is not told twice.
      const since = new Date(deps.now().getTime() - REPEAT_WINDOW_MINUTES * 60_000).toISOString();
      const alreadyTold = (order: SellerOrder) =>
        request.type === 'ready_now' &&
        order.status === 'ready_for_pickup' &&
        order.inbox.some(
          (entry) =>
            entry.at >= since &&
            ((entry.kind === 'status' && entry.status === 'ready_for_pickup') ||
              (entry.kind === 'message' && entry.textKey === 'ready')),
        );
      const targets = orders.filter(
        (order) =>
          !isFinalStatus(order.status) &&
          (order.pickupPlaceId ?? first) === placeId &&
          !alreadyTold(order),
      );
      if (targets.length === 0 && request.force !== true) {
        return warn(
          'confirm_required',
          { code: 'nobody_to_message', count: 0 },
          'No open orders for this place',
        );
      }

      const at = nowIso();
      let readied = 0;
      const drafts = targets.map((order) => {
        let d = draft(order);
        const by: AuditEntry['by'] = { role: actor.role, name: actor.name };
        if (request.type === 'ready_now') {
          if (order.status === 'ready_for_pickup') {
            d = withInbox(d, { kind: 'message', textKey: 'ready' }, at);
          } else {
            d = withStatus(d, 'ready_for_pickup', by, at);
            readied++;
          }
        } else if (request.type === 'ready_in') {
          d = withInbox(d, { kind: 'message', textKey: 'readyIn', minutes: request.minutes }, at);
        } else {
          const own = order.language === 'id' ? request.text.id : request.text.en;
          const text = own ?? request.text.en ?? request.text.id ?? '';
          d = withInbox(d, { kind: 'message', text }, at);
        }
        return d;
      });
      const entry = newEntry(menuId, group, type, targets.length, {
        ...(request.type === 'ready_in' ? { minutes: request.minutes } : {}),
        ...(request.type === 'custom' ? { text: request.text } : {}),
      });
      const entryAt: MessageLogEntry = { ...entry, at };
      // The log row goes in the last batch, so a failure in any batch leaves no row and a retry
      // is not flagged as a repeat.
      const last = Math.floor(Math.max(drafts.length - 1, 0) / BATCH_ORDERS) * BATCH_ORDERS;
      for (let from = 0; from < Math.max(drafts.length, 1); from += BATCH_ORDERS) {
        await db.batch([
          ...drafts.slice(from, from + BATCH_ORDERS).flatMap((d) => changeStatements(db, d)),
          ...(from === last ? logStatements(entryAt) : []),
        ]);
      }
      tell(drafts);
      return ok({ message: entryAt, sent: targets.length, readied });
    },

    async deliveryStep(code, request, actor) {
      const order = await readLiveOrder(db, sid, 'code', code);
      const menuId = await currentMenuId();
      if (!order || !menuId) return fail('not_found', 'Order not found');
      const step: DeliveryStep = request.step;
      if (request.force !== true) {
        if (order.fulfilment !== 'delivery') {
          return warn('invalid_status', { code: 'not_delivery' }, 'This is not a delivery order');
        }
        if (isFinalStatus(order.status)) {
          return warn('invalid_status', { code: 'order_closed' }, 'This order is closed');
        }
        if (await sentRecently(menuId, `order:${order.code}`, step)) {
          return warn('confirm_required', { code: 'step_repeated' }, 'This step was already sent');
        }
        const expected: OrderStatus =
          step === 'out_for_delivery' ? 'confirmed' : 'out_for_delivery';
        if (order.status !== expected) {
          return warn(
            'confirm_required',
            { code: 'step_out_of_order' },
            'This step comes at another point',
          );
        }
      }
      const at = nowIso();
      const by: AuditEntry['by'] = { role: actor.role, name: actor.name };
      let d = draft(order);
      if (step === 'arriving_soon') {
        d = withInbox(
          d,
          request.minutes !== undefined
            ? { kind: 'message', textKey: 'arrivingIn', minutes: request.minutes }
            : { kind: 'message', textKey: 'arrivingSoon' },
          at,
        );
      } else {
        d = withStatus(d, step, by, at);
      }
      const entry: MessageLogEntry = {
        ...newEntry(menuId, `order:${order.code}`, step, 1, {
          ...(request.minutes !== undefined ? { minutes: request.minutes } : {}),
        }),
        at,
      };
      await db.batch([...logStatements(entry), ...changeStatements(db, d)]);
      tell([d]);
      return ok({ order: d.order, message: entry });
    },

    async markCollected(code, request, actor) {
      return commitCollect(
        await readLiveOrder(db, sid, 'code', code),
        'seller',
        actor,
        request.force === true,
      );
    },

    async customerCollected(token) {
      return commitCollect(
        await readLiveOrder(db, sid, 'token', token),
        'customer',
        undefined,
        false,
      );
    },
  };
}
