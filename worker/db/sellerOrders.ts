// Orders: the customer side and the seller and chef side (split out of seller.ts, plan 098 C3; the code is unchanged).
import { isAddressReadable } from '../../shared/address';
import { diffOrder, formatAuditDiff } from '../../shared/auditDiff';
import {
  FULFILMENT_CHANGED_KEY,
  ORDER_EDITED_KEY,
  fulfilmentChangedText,
} from '../../shared/pushText';
import type { OrderStatus, SellerOrder, StaffActor } from '../../shared/domain';
import type {
  ChangeFulfilmentRequest,
  CreateOrderRequest,
  CreateSellerOrderRequest,
  EditSellerOrderRequest,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import { parseOrderCode } from '../../shared/orderCode';
import { isFinalStatus, nextStatuses } from '../../shared/status';
import {
  statusOfTemplate,
  type SendUpdatesRequest,
  type UpdateResult,
} from '../../shared/updateContract';
import type { SellerRepository } from '../repo/Repository';
import { changeStatements, lineNotesChanged, LIVE_MENU, readLiveOrder, readOrders } from './orders';
import { fail, ok, warn, type Draft } from './sellerShared';
import { type SellerContext } from './sellerContext';

/** Plan 114: how long a client order id is remembered. */
const CLIENT_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Orders: the customer side and the seller and chef side. */
export function ordersPart(
  c: SellerContext,
): Pick<
  SellerRepository,
  | 'createOrder'
  | 'updateOrder'
  | 'cancelOrder'
  | 'createSellerOrder'
  | 'getByCode'
  | 'orderByClientId'
  | 'setOrderAddress'
  | 'orderAddresses'
  | 'listOrders'
  | 'setStatus'
  | 'setPaid'
  | 'setLocked'
  | 'changeFulfilment'
  | 'editOrder'
  | 'setWaReceived'
  | 'nudge'
  | 'markAddressSeen'
  | 'markSeen'
  | 'sendUpdates'
> {
  const {
    db,
    sid,
    nowIso,
    notify,
    loadState,
    readOrderWithState,
    closedError,
    draft,
    addAudit,
    addInbox,
    withOrder,
    isPortionRace,
    lostRace,
    commit,
    fulfilmentRefusal,
    place,
    patched,
    editDraft,
    changeByCode,
  } = c;
  /**
   * The order this client id already made, only when a customer would still want it: this kitchen's
   * live menu order (not archived, not private), under 24 hours old, not cancelled. Fails open: any
   * error is logged and answers "none", so the order is placed normally.
   */
  async function orderByClientId(clientOrderId: string): Promise<SellerOrder | undefined> {
    try {
      const since = new Date(new Date(nowIso()).getTime() - CLIENT_ORDER_WINDOW_MS).toISOString();
      const row = await db.first<{ token: string }>(
        `SELECT token FROM orders AS o WHERE o.seller_id = ? AND o.client_order_id = ? AND o.created_at >= ? AND o.status <> 'cancelled' AND ${LIVE_MENU}`,
        sid,
        clientOrderId,
        since,
      );
      return row ? await readLiveOrder(db, sid, 'token', row.token) : undefined;
    } catch (error) {
      console.error('client order id lookup failed; placing the order normally', error);
      return undefined;
    }
  }

  return {
    // ---- Orders: customer side ----

    /** Customer order: refused for a draft week, when closed by the seller, or after the cut-off. */
    async createOrder(input: CreateOrderRequest) {
      // Plan 114: the same client id again (the answer was lost) returns the order already made,
      // even if the menu has closed since.
      if (input.clientOrderId !== undefined) {
        const again = await orderByClientId(input.clientOrderId);
        if (again) return ok(again);
      }
      const s = await loadState();
      if (s.week.status !== 'published') return fail('week_not_published', 'The menu is not open');
      const closed = closedError<SellerOrder>(s);
      if (closed) return closed;
      return place(s, input, { role: 'customer', name: input.firstName }, undefined, {
        returning: input.returning ?? false,
      });
    },

    /** Customer change: not when closed, locked or final. */
    async updateOrder(token: string, patch: UpdateOrderRequest, known?: SellerOrder) {
      // `known` is the order the token lookup just read; without it the order and state come in one trip.
      const { order, state: s } = known
        ? { order: known, state: await loadState(known.id) }
        : await readOrderWithState('token', token);
      if (!order) return fail('not_found', 'Order not found');
      const closed = closedError<SellerOrder>(s);
      if (closed) return closed;
      if (order.locked) return fail('order_locked', 'The seller has locked this order');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      if (patch.fulfilment && patch.fulfilment !== order.fulfilment) {
        const refused = fulfilmentRefusal(s, patch.fulfilment);
        if (refused) return refused;
      }
      const next = patched(s, order, patch);
      if (!next.ok) return next;
      const edited = editDraft(order, next.value, patch.lines !== undefined);
      if (!edited) return ok(order);
      try {
        return ok(await commit(edited));
      } catch (error) {
        if (!isPortionRace(error) || !patch.lines) throw error;
        return lostRace(await loadState(order.id), patch.lines, order.lines);
      }
    },

    /** Customer cancel (a change, so refused when closed or locked). */
    async cancelOrder(token: string, known?: SellerOrder) {
      const { order, state: s } = known
        ? { order: known, state: await loadState(known.id) }
        : await readOrderWithState('token', token);
      if (!order) return fail('not_found', 'Order not found');
      const closed = closedError<SellerOrder>(s);
      if (closed) return closed;
      if (order.locked) return fail('order_locked', 'The seller has locked this order');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      const cancelled = addInbox(withOrder(draft(order), { status: 'cancelled' }), {
        kind: 'status',
        status: 'cancelled',
      });
      const done = await commit(
        addAudit(cancelled, {
          by: { role: 'customer', name: order.firstName },
          what: 'status',
          detail: 'cancelled',
        }),
      );
      // A cancelled order has nothing more to push.
      await db
        .stmt('DELETE FROM push_subscriptions WHERE seller_id = ? AND order_id = ?', sid, order.id)
        .run();
      return ok(done);
    },

    // ---- Orders: seller and chef side ----

    /**
     * Seller/chef-entered order: starts confirmed unless `confirmNow` is false, `paid` defaults
     * to false (D-027). Allowed after the cut-off (D-024).
     */
    async createSellerOrder(input: CreateSellerOrderRequest, actor: StaffActor) {
      const s = await loadState();
      return place(s, input, actor, actor, {
        status: input.confirmNow === false ? 'ordered' : 'confirmed',
        paid: input.paid ?? false,
        ...(input.force === true ? { force: true } : {}),
      });
    },

    getByCode: (code: string) => readLiveOrder(db, sid, 'code', code),

    orderByClientId,

    async setOrderAddress(orderId: string, cipher: string | null, edited = false) {
      // Only a flag is kept for a customer's change: the old address is never stored (D-099).
      await db.batch([
        db.stmt(
          `UPDATE orders SET address_enc = ?${
            edited ? ', address_changed = 1, address_seen = 0, changed = 1, updated_at = ?' : ''
          } WHERE seller_id = ? AND id = ? AND past_week_id IS NULL`,
          cipher,
          ...(edited ? [nowIso()] : []),
          sid,
          orderId,
        ),
      ]);
    },

    async orderAddresses(codes?: ReadonlyArray<string>) {
      if (codes !== undefined && codes.length === 0) return new Map<string, string>();
      const rows = await db.all<{ code: string; address_enc: string }>(
        `SELECT code, address_enc FROM orders WHERE seller_id = ? AND past_week_id IS NULL AND address_enc IS NOT NULL${
          codes ? ` AND code IN (${codes.map(() => '?').join(', ')})` : ''
        }`,
        sid,
        ...(codes ?? []),
      );
      return new Map(rows.map((row) => [row.code, row.address_enc]));
    },

    /** Newest first. */
    async listOrders() {
      return (await readOrders(db, sid, LIVE_MENU)).reverse();
    },

    /** Moves the order on, tells the customer, and clears the "changed" flag. */
    setStatus(code: string, to: OrderStatus, actor: StaffActor, force = false) {
      return changeByCode(code, (order) => {
        // D-062: a jump (or leaving a closed order) warns; `force` goes ahead.
        if (!force && !nextStatuses(order).includes(to)) {
          return warn(
            'invalid_status',
            { code: 'status_out_of_order' },
            `Cannot move from ${order.status} to ${to}`,
          );
        }
        const moved = addInbox(withOrder(draft(order), { status: to, changed: false }), {
          kind: 'status',
          status: to,
        });
        return ok(addAudit(moved, { by: actor, what: 'status', detail: to }));
      });
    },

    setPaid(code: string, paid: boolean, actor: StaffActor) {
      return changeByCode(code, (order) =>
        ok(
          addAudit(withOrder(draft(order), { paid }), {
            by: actor,
            what: 'paid',
            detail: paid ? 'paid' : 'unpaid',
          }),
        ),
      );
    },

    /** Seller lock: the customer can't change or cancel; the seller still can. */
    setLocked(code: string, locked: boolean) {
      return changeByCode(code, (order) =>
        ok(withOrder(draft(order), { locked, updatedAt: nowIso() })),
      );
    },

    /**
     * Plan 083: the seller (owner or chef) switches pickup <-> delivery, also after the cut-off and
     * on a locked order; menu and private orders alike. The address itself is stored by the route
     * (encrypted, D-099). With `notify` the customer gets an inbox entry in the order's language
     * (and so a push). Cancelled, delivered and collected orders are refused.
     */
    async changeFulfilment(code: string, input: ChangeFulfilmentRequest, actor: StaffActor) {
      const order = await readLiveOrder(db, sid, 'code', code);
      if (!order) return fail('not_found', 'Order not found');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      let place: { name: string; times: string } | undefined;
      if (input.fulfilment === 'pickup') {
        const row = await db.first<{ place: string; window_start: string; window_end: string }>(
          'SELECT place, window_start, window_end FROM pickup_places WHERE seller_id = ? AND id = ?',
          sid,
          input.pickupPlaceId ?? '',
        );
        if (!row) return fail('invalid_request', 'Unknown pickup place');
        // This menu's own time for the place wins over the place's usual one.
        const point = (await loadState(order.id)).week.pickupPoints.find(
          (candidate) => candidate.id === input.pickupPlaceId,
        );
        const window = point?.window ?? { start: row.window_start, end: row.window_end };
        place = { name: row.place, times: `${window.start}–${window.end}` };
      } else if (!isAddressReadable(input.address)) {
        return fail('invalid_request', 'A delivery address needs a street');
      }
      const next: SellerOrder = { ...order, fulfilment: input.fulfilment };
      delete next.pickupPlaceId;
      if (input.fulfilment === 'pickup' && input.pickupPlaceId !== undefined) {
        next.pickupPlaceId = input.pickupPlaceId;
      }
      const diff = diffOrder(order, next);
      let d = addAudit(draft(next), {
        by: actor,
        what: 'edited',
        detail: 'fulfilment',
        ...(diff ? { diff } : {}),
      });
      if (input.notify) {
        const text = fulfilmentChangedText(
          order.language,
          place ? { pickup: place.name, times: place.times } : { delivery: true },
        );
        d = addInbox(d, { kind: 'message', textKey: FULFILMENT_CHANGED_KEY, text });
      }
      await db.batch([
        ...changeStatements(db, d),
        db.stmt(
          'UPDATE orders SET pickup_place_id = ? WHERE seller_id = ? AND id = ?',
          next.pickupPlaceId ?? null,
          sid,
          order.id,
        ),
      ]);
      if (d.inboxes.length > 0) notify?.([{ order: d.order, entries: d.inboxes }]);
      return ok(d.order);
    },

    /**
     * Plan 105: the owner or chef edits dishes, note or first name of a menu order in any status, also
     * after the cut-off or on a locked order (D-024). Over a portion limit warns (D-062; `force`
     * goes ahead). The seller has now seen the order, so the "Changed" flag clears. A cancelled order
     * stays cancelled unless `reactivate`, which puts it back to Ordered. `notify` adds an inbox
     * entry (so a push) with the diff in the order's language.
     */
    async editOrder(code: string, input: EditSellerOrderRequest, actor: StaffActor) {
      // Dishes to check: the order and the state come in one trip.
      const read = input.lines
        ? await readOrderWithState('code', code)
        : { order: await readLiveOrder(db, sid, 'code', code), state: undefined };
      const order = read.order;
      if (!order) return fail('not_found', 'Order not found');
      if (order.private) return fail('private_order', 'This is a private order');
      const reactivate = order.status === 'cancelled' && input.reactivate === true;
      let next: SellerOrder = order;
      if (input.lines && read.state) {
        const s = read.state;
        // A cancelled order that stays cancelled holds no portions, so nothing to warn about.
        const over = input.force === true || (order.status === 'cancelled' && !reactivate);
        const lines = c.buildLines(s, input.lines, order.lines, over ? 'allow' : 'warn', true);
        if (!lines.ok) return lines;
        next = { ...next, lines: lines.value };
      }
      if (input.firstName !== undefined) next = { ...next, firstName: input.firstName };
      if (input.note !== undefined) {
        next = { ...next };
        if (input.note === '') delete next.note;
        else next.note = input.note;
      }
      const diff = diffOrder(order, next, { staff: true });
      const notes = lineNotesChanged(order.lines, next.lines);
      if (!diff && !reactivate && !notes) return ok(order);
      let d = withOrder(
        {
          ...draft(next),
          linesChanged: (diff?.items.length ?? 0) > 0 || reactivate || notes,
        },
        { changed: false },
      );
      if (reactivate) {
        d = addInbox(withOrder(d, { status: 'ordered' }), { kind: 'status', status: 'ordered' });
        d = addAudit(d, { by: actor, what: 'status', detail: 'ordered' });
      }
      if (diff) {
        d = addAudit(d, { by: actor, what: 'edited', diff });
        if (input.notify) {
          d = addInbox(d, {
            kind: 'message',
            textKey: ORDER_EDITED_KEY,
            text: formatAuditDiff(diff, order.language),
          });
        }
      }
      try {
        const done = await commit(d, input.force === true);
        if (d.inboxes.length > 0) notify?.([{ order: done, entries: d.inboxes }]);
        return ok(done);
      } catch (error) {
        if (!isPortionRace(error) || !input.lines) throw error;
        return lostRace(await loadState(order.id), input.lines, order.lines);
      }
    },

    setWaReceived(code: string, received: boolean) {
      return changeByCode(code, (order) => ok(withOrder(draft(order), { waReceived: received })));
    },

    /** Adds a nudge to the customer's inbox; the text key differs for returning customers. */
    nudge(code: string, force = false) {
      return changeByCode(code, (order) => {
        if (!force && isFinalStatus(order.status)) {
          return warn('invalid_status', { code: 'order_closed' }, 'This order is closed');
        }
        const textKey = order.returning ? 'nudgeReturning' : 'nudge';
        return ok(
          withOrder(addInbox(draft(order), { kind: 'nudge', textKey }), { updatedAt: nowIso() }),
        );
      });
    },

    /** A team member tapped "Got it" on the customer's changed address. */
    async markAddressSeen(code: string) {
      const order = await readLiveOrder(db, sid, 'code', code);
      if (!order) return fail('not_found', 'Order not found');
      await db.batch([
        db.stmt(
          'UPDATE orders SET address_seen = 1 WHERE seller_id = ? AND id = ? AND address_changed = 1',
          sid,
          order.id,
        ),
      ]);
      return ok((await readLiveOrder(db, sid, 'code', code)) ?? order);
    },

    /** The seller has seen the customer's change. */
    markSeen(code: string) {
      return changeByCode(code, (order) => ok(withOrder(draft(order), { changed: false })));
    },

    /**
     * Bulk updates (stage 7.1): the live orders are read once and the changes written in batches.
     * Cancelled orders get nothing. The message goes to
     * the inbox as a `message` entry (`textKey` = the template, `minutes`, or the custom `text`);
     * with `alsoSetStatus` the status moves too, but only where nextStatuses allows it. When the
     * template is the plain twin of the status it moved to (ready, outForDelivery, delivered,
     * collected), the status entry already says it, so no second message is added.
     */
    async sendUpdates(
      rawCodes: ReadonlyArray<string>,
      update: Omit<SendUpdatesRequest, 'codes'>,
      actor: StaffActor,
    ): Promise<Array<UpdateResult>> {
      const live = rawCodes.some((raw) => parseOrderCode(raw) !== null)
        ? await readOrders(db, sid, 'o.past_week_id IS NULL')
        : [];
      const byCode = new Map(live.map((order) => [order.code, order]));
      const drafts: Array<Draft> = [];
      const results = rawCodes.map((rawCode): UpdateResult => {
        const code = parseOrderCode(rawCode);
        const order = code ? byCode.get(code) : undefined;
        if (!code || !order) return { code: rawCode, ok: false, error: 'not_found' };
        // D-062: a cancelled order is reached only when the seller says so (`force`).
        if (order.status === 'cancelled' && update.force !== true) {
          return {
            code,
            ok: false,
            error: 'invalid_status',
            warning: { code: 'order_cancelled' },
          };
        }
        const wanted = update.alsoSetStatus === true ? statusOfTemplate(update.template) : null;
        const target = wanted !== null && nextStatuses(order).includes(wanted) ? wanted : null;
        const allowed = target !== null;
        const twin = ['ready', 'outForDelivery', 'delivered', 'collected'].includes(
          update.template,
        );
        let current = draft(order);
        if (!(allowed && twin)) {
          current = withOrder(
            addInbox(current, {
              kind: 'message',
              ...(update.template === 'custom'
                ? { text: update.text ?? '' }
                : { textKey: update.template }),
              ...(update.minutes !== undefined ? { minutes: update.minutes } : {}),
            }),
            { updatedAt: nowIso() },
          );
        }
        if (target !== null) {
          const moved = addInbox(withOrder(current, { status: target, changed: false }), {
            kind: 'status',
            status: target,
          });
          current = addAudit(moved, { by: actor, what: 'status', detail: target });
        }
        // The same order twice in one request is written once (the repeat answers not_found).
        byCode.delete(code);
        drafts.push(current);
        return { code, ok: true, statusChanged: allowed };
      });
      // About 5 statements an order: 50 orders a batch keeps each batch modest.
      for (let from = 0; from < drafts.length; from += 50) {
        await db.batch(drafts.slice(from, from + 50).flatMap((d) => changeStatements(db, d)));
      }
      notify?.(
        drafts
          .filter((d) => d.inboxes.length > 0)
          .map((d) => ({ order: d.order, entries: d.inboxes })),
      );
      return results;
    },
  };
}
