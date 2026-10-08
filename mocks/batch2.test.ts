import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest } from '../shared/orderContract';
import {
  createSellerStore as createStore,
  type SellerStore as MockStore,
  type StoreResult,
} from '../worker/mock/store';

const BEFORE = new Date('2026-10-07T10:00:00Z');
const AFTER = new Date('2026-10-09T10:00:01Z'); // 21:00:01 Melbourne (+11:00)

let clock = BEFORE;
let store: MockStore;

const staff = { role: 'seller', name: 'Bu Ani' } as const;

function req(
  lines: CreateOrderRequest['lines'],
  extra: Partial<CreateOrderRequest> = {},
): CreateOrderRequest {
  return { firstName: 'Rina', language: 'en', fulfilment: 'pickup', lines, ...extra };
}

const one = (itemId: string, qty = 1) => req([{ itemId, qty }]);

function expectOk<T>(result: StoreResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.value;
}

beforeEach(() => {
  clock = BEFORE;
  store = createStore({ now: () => clock });
});

describe('lock (D-027)', () => {
  it('blocks customer edit and cancel but not seller actions', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    const locked = expectOk(store.setLocked(order.code, true));
    expect(locked.locked).toBe(true);
    expect(store.updateOrder(order.token, { note: 'x' })).toMatchObject({
      ok: false,
      error: 'order_locked',
    });
    expect(store.cancelOrder(order.token)).toMatchObject({ ok: false, error: 'order_locked' });
    expect(store.setStatus(order.code, 'confirmed', staff)).toMatchObject({ ok: true });
    expect(store.setPaid(order.code, true, staff)).toMatchObject({ ok: true });
    expect(store.nudge(order.code)).toMatchObject({ ok: true });
    expect(expectOk(store.setLocked(order.code, false)).locked).toBe(false);
    expect(store.updateOrder(order.token, { note: 'x' })).toMatchObject({ ok: true });
  });

  it('lets the seller lock after the cut-off', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    clock = AFTER;
    expect(store.setLocked(order.code, true)).toMatchObject({ ok: true });
    expect(store.setWaReceived(order.code, true)).toMatchObject({ ok: true });
  });
});

describe('changed flag and audit diff', () => {
  it('is set by a customer edit with a diff, and cleared by a status change', () => {
    const order = expectOk(store.createOrder(req([{ itemId: 'pesmol', qty: 1 }])));
    expect(order.changed).toBe(false);
    const edited = expectOk(
      store.updateOrder(order.token, {
        lines: [
          { itemId: 'pesmol', qty: 2 },
          { itemId: 'tempe-mendoan', qty: 1 },
        ],
        fulfilment: 'delivery',
        note: 'less salt',
      }),
    );
    expect(edited.changed).toBe(true);
    expect(edited.audit[0]?.diff).toEqual({
      items: [
        { itemId: 'pesmol', name: { en: 'Tilapia pesmol', id: 'Pesmol ikan nila' }, delta: 1 },
        {
          itemId: 'tempe-mendoan',
          name: { en: 'Thin battered tempeh', id: 'Tempe mendoan' },
          delta: 1,
        },
      ],
      note: true,
      fulfilment: { from: 'pickup', to: 'delivery' },
    });
    expect(expectOk(store.setStatus(order.code, 'confirmed', staff)).changed).toBe(false);
  });

  it('is cleared by seen, and an edit that changes nothing is not a change', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    const same = expectOk(
      store.updateOrder(order.token, { lines: [{ itemId: 'pesmol', qty: 1 }] }),
    );
    expect(same.changed).toBe(false);
    expect(same.audit).toHaveLength(1);
    expect(expectOk(store.updateOrder(order.token, { note: 'x' })).changed).toBe(true);
    expect(expectOk(store.markSeen(order.code)).changed).toBe(false);
  });
});

describe('inbox', () => {
  it('records a status entry for creation and every status change', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    expect(order.inbox).toEqual([expect.objectContaining({ kind: 'status', status: 'ordered' })]);
    const moved = expectOk(store.setStatus(order.code, 'confirmed', staff));
    expect(moved.inbox.map((entry) => entry.status)).toEqual(['confirmed', 'ordered']);
    const entered = expectOk(store.createSellerOrder(one('pesmol'), staff));
    expect(entered.inbox[0]).toMatchObject({ kind: 'status', status: 'confirmed' });
  });

  it('nudge adds the key by returning, and is refused on a closed order', () => {
    const fresh = expectOk(store.createOrder(one('pesmol')));
    const back = expectOk(store.createOrder({ ...one('pesmol'), returning: true }));
    expect(expectOk(store.nudge(fresh.code)).inbox[0]).toMatchObject({
      kind: 'nudge',
      textKey: 'nudge',
    });
    expect(expectOk(store.nudge(back.code)).inbox[0]).toMatchObject({
      kind: 'nudge',
      textKey: 'nudgeReturning',
    });
    expectOk(store.cancelOrder(fresh.token));
    expect(store.nudge(fresh.code)).toMatchObject({ ok: false, error: 'invalid_status' });
  });

  it('keeps the newest 20', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    for (let n = 0; n < 25; n++) expectOk(store.nudge(order.code));
    const last = expectOk(store.nudge(order.code));
    expect(last.inbox).toHaveLength(20);
    expect(last.inbox[0]?.kind).toBe('nudge');
  });
});

describe('seller-entered options (D-027)', () => {
  it('defaults to confirmed and unpaid, and is never returning', () => {
    const order = expectOk(store.createSellerOrder(one('pesmol'), staff));
    expect(order).toMatchObject({ status: 'confirmed', paid: false, returning: false });
  });

  it('honours confirmNow false and paid true', () => {
    const order = expectOk(
      store.createSellerOrder({ ...one('pesmol'), confirmNow: false, paid: true }, staff),
    );
    expect(order).toMatchObject({ status: 'ordered', paid: true, enteredBy: staff });
  });
});

describe('settings and ordering switch', () => {
  it('exposes the number and the open state on the menu', () => {
    expect(store.getMenu().ordering).toEqual({ open: true });
    expect(store.getMenu().kitchen.whatsappNumber).toBeUndefined();
    store.setSettings({ ...store.getSettings(), whatsappNumber: '61412345678' });
    expect(store.getMenu().kitchen.whatsappNumber).toBe('61412345678');
  });

  it('closes by the seller switch and refuses create, change and cancel', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    store.setSettings({ ...store.getSettings(), orderingOpen: false });
    expect(store.getMenu().ordering).toEqual({ open: false, reason: 'closed_by_seller' });
    expect(store.createOrder(one('pesmol'))).toMatchObject({ ok: false, error: 'ordering_closed' });
    expect(store.updateOrder(order.token, { note: 'x' })).toMatchObject({
      ok: false,
      error: 'ordering_closed',
    });
    expect(store.cancelOrder(order.token)).toMatchObject({ ok: false, error: 'ordering_closed' });
    expect(store.createSellerOrder(one('pesmol'), staff)).toMatchObject({ ok: true });
  });

  it('closes at the cut-off with the injected clock', () => {
    clock = AFTER;
    expect(store.getMenu().ordering).toEqual({ open: false, reason: 'cutoff_passed' });
    store.setSettings({ ...store.getSettings(), orderingOpen: false });
    expect(store.getMenu().ordering.reason).toBe('closed_by_seller');
  });
});

describe('sample orders (D-027 variety)', () => {
  it('include returning, changed with a diff, locked, notes and both fulfilments', () => {
    store.addSampleOrders(60);
    const all = store.listOrders();
    expect(all.some((order) => order.returning)).toBe(true);
    expect(all.some((order) => order.locked)).toBe(true);
    expect(all.some((order) => order.note !== undefined)).toBe(true);
    expect(new Set(all.map((order) => order.fulfilment)).size).toBe(2);
    const changed = all.filter((order) => order.changed);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((order) => order.audit[0]?.diff !== undefined)).toBe(true);
  });
});
