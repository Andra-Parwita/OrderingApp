// Dev sample orders, split out of seller.ts (plan 098 C3; the code is unchanged).
import type { SampleOrdersResponse } from '../../shared/devContract';
import type { MenuItem, OrderStatus, PickupPoint } from '../../shared/domain';
import type { CreateOrderRequest, RequestedLine } from '../../shared/orderContract';
import { generateOrderCode, generateToken } from '../../shared/orderCode';
import { isFinalStatus } from '../../shared/status';
import { changeStatements, insertOrderStatements } from './orders';
import { type SampleState, SAMPLE_NAMES, SAMPLE_NOTES, newSampleState } from './sellerShared';
import { type SellerContext } from './sellerContext';

/** Dev sample orders (plan 008). */
export function samplesPart(c: SellerContext) {
  const {
    deps,
    db,
    seller,
    sid,
    loadState,
    buildLines,
    draft,
    addInbox,
    withOrder,
    uniqueCode,
    buildOrder,
    sampleFulfilment,
    patched,
    editDraft,
  } = c;

  // ---- Samples (dev) ----

  async function sampleState(): Promise<SampleState> {
    let state = deps.samples.get(sid);
    if (!state) {
      const row = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM sellers WHERE rowid < (SELECT rowid FROM sellers WHERE id = ?)',
        sid,
      );
      // The Worker builds a fresh repository per request, so the seed also moves with the orders
      // already held: a second "add" must not replay the first one's tokens (they are unique).
      const held = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM orders WHERE seller_id = ?',
        sid,
      );
      state = newSampleState(deps.seed + (row?.n ?? 0) + (held?.n ?? 0) * 7919);
      deps.samples.set(sid, state);
    }
    return state;
  }

  /**
   * Plan 008: samples follow the seller's current menu (its dishes, places, cooking day and
   * delivery setting, read fresh on every call), spread over every status, paid or not, changed,
   * notes and repeat customers. Limits are never exceeded: what does not fit is skipped, and the
   * answer says why fewer went in. A finished menu (or none) adds nothing.
   */
  async function addSampleOrders(count: number): Promise<SampleOrdersResponse> {
    const menu = await db.first<{ state: string }>(
      'SELECT state FROM menus WHERE seller_id = ?',
      sid,
    );
    if (!menu || menu.state === 'finished') return { added: 0, reason: 'no_menu' };
    const s = await loadState();
    if (s.items.length === 0) return { added: 0, reason: 'no_menu' };
    const sample = await sampleState();
    const { random } = sample;
    // Ids restart with a fresh worker; start past every order this seller already has.
    const existing = await db.first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM orders WHERE seller_id = ?',
      sid,
    );
    sample.counter = Math.max(sample.counter, existing?.n ?? 0);
    let added = 0;
    for (let n = 0; n < count; n++) {
      // Dishes that still have portions (not sold out by hand, limit not used up).
      const items = s.items.filter(
        (item) =>
          item.soldOut !== true &&
          item.preorder !== false &&
          (item.limit === undefined || item.limit - (s.used.get(item.id) ?? 0) > 0),
      );
      if (items.length === 0) break;
      const picks = items.filter(() => random() < 0.4);
      if (picks.length === 0) picks.push(items[Math.floor(random() * items.length)] as MenuItem);
      const requested: Array<RequestedLine> = [];
      for (const item of picks.slice(0, 3)) {
        const left = item.limit === undefined ? 3 : item.limit - (s.used.get(item.id) ?? 0);
        const qty = Math.min(1 + Math.floor(random() * 3), left);
        if (qty >= 1) requested.push({ itemId: item.id, qty });
      }
      if (requested.length === 0) continue;
      const lines = buildLines(s, requested);
      if (!lines.ok) continue;
      const firstName = SAMPLE_NAMES[Math.floor(random() * SAMPLE_NAMES.length)] as string;
      const note =
        random() < 0.3
          ? (SAMPLE_NOTES[Math.floor(random() * SAMPLE_NOTES.length)] as string)
          : undefined;
      const input: CreateOrderRequest = {
        firstName,
        language: random() < 0.5 ? 'en' : 'id',
        lines: requested,
        fulfilment: sampleFulfilment(s, random() < 0.4),
        ...(note !== undefined ? { note } : {}),
        // Pickup samples rotate over the menu's places (no random draw, so seeds stay stable).
        ...(s.week.pickupPoints.length > 0
          ? {
              pickupPlaceId: (
                s.week.pickupPoints[sample.counter % s.week.pickupPoints.length] as PickupPoint
              ).id,
            }
          : {}),
      };
      const code = await uniqueCode(() => generateOrderCode(sample.fill));
      const order = buildOrder(
        input,
        lines.value,
        { role: 'customer', name: firstName },
        undefined,
        {
          id: `sample-${seller.slug}-${String(++sample.counter)}`,
          code,
          token: generateToken(sample.fill),
        },
        { returning: random() < 0.3 },
      );
      let current = draft(order);
      if (random() < 0.25) current = withOrder(current, { waReceived: true });
      if (random() < 0.2) {
        // A customer edit after placing: flip fulfilment, change the note, and add an unlimited item.
        const extra = items.find(
          (item) =>
            item.limit === undefined &&
            !current.order.lines.some((line) => line.itemId === item.id),
        );
        const edit = patched(s, current.order, {
          fulfilment: sampleFulfilment(s, current.order.fulfilment === 'pickup'),
          note: 'Changed my mind, thanks',
          ...(extra ? { lines: [...current.order.lines, { itemId: extra.id, qty: 1 }] } : {}),
        });
        if (edit.ok) {
          const edited = editDraft(current.order, edit.value, true);
          if (edited) {
            current = {
              ...edited,
              audits: [...current.audits, ...edited.audits],
              inboxes: [...current.inboxes, ...edited.inboxes],
            };
          }
        }
      }
      // Spread over the statuses (the fulfilment is final by now, so the next step fits it).
      const stage = random();
      const fulfilled = current.order.fulfilment === 'pickup';
      const status: OrderStatus =
        stage < 0.3
          ? 'ordered'
          : stage < 0.55
            ? 'confirmed'
            : stage < 0.75
              ? fulfilled
                ? 'ready_for_pickup'
                : 'out_for_delivery'
              : stage < 0.92
                ? fulfilled
                  ? 'collected'
                  : 'delivered'
                : 'cancelled';
      if (status !== 'ordered') {
        current = addInbox(withOrder(current, { status }), { kind: 'status', status });
      }
      const paidChance = status === 'cancelled' ? 0 : isFinalStatus(status) ? 0.9 : 0.35;
      if (random() < paidChance) current = withOrder(current, { paid: true });
      if (random() < 0.15) current = withOrder(current, { locked: true });
      await db.batch([
        ...insertOrderStatements(db, order, null),
        db.stmt('UPDATE orders SET sample = 1 WHERE seller_id = ? AND id = ?', sid, order.id),
        ...changeStatements(db, current),
      ]);
      added++;
      if (status !== 'cancelled') {
        for (const line of current.order.lines) {
          s.used.set(line.itemId, (s.used.get(line.itemId) ?? 0) + line.qty);
        }
      }
    }
    return added === count ? { added } : { added, reason: 'sold_out' };
  }

  /** Plan 013: removes this seller's sample orders and their rows; nothing else is touched. */
  async function clearSampleOrders(): Promise<{ removed: number }> {
    const counted = await db.first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND sample = 1',
      sid,
    );
    // Children first (the cascade would do it too; this does not rely on it).
    const children = ['order_lines', 'order_audit', 'order_inbox', 'push_subscriptions'].map(
      (table) =>
        db.stmt(
          `DELETE FROM ${table} WHERE seller_id = ? AND order_id IN (SELECT id FROM orders WHERE seller_id = ? AND sample = 1)`,
          sid,
          sid,
        ),
    );
    await db.batch([
      ...children,
      db.stmt('DELETE FROM orders WHERE seller_id = ? AND sample = 1', sid),
    ]);
    return { removed: counted?.n ?? 0 };
  }

  return { addSampleOrders, clearSampleOrders };
}
