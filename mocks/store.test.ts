import { beforeEach, describe, expect, it } from 'vitest';
import { parseMenuResponse } from '../shared/menuContract';
import { parseOrder, type CreateOrderRequest } from '../shared/orderContract';
import { createStore, type MockStore, type StoreResult } from '../worker/mock/store';

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

const item = (id: string) => store.getMenu().items.find((candidate) => candidate.id === id);

beforeEach(() => {
  clock = BEFORE;
  store = createStore({ now: () => clock });
});

describe('menu', () => {
  it('is the seeded fixture and matches the contract', () => {
    const menu = store.getMenu();
    expect(parseMenuResponse(menu)).not.toBeNull();
    expect(menu.kitchen.name).toBe('Delave');
    expect(menu.items).toHaveLength(6);
    expect(item('lemper')).toMatchObject({ limit: 20, remaining: 20 });
    expect(item('lemper')).not.toHaveProperty('chefId');
    expect(menu).not.toHaveProperty('chefs');
  });

  it('gives the seller the chefs and chef ids', () => {
    const menu = store.getSellerMenu();
    expect(menu.chefs).toEqual([{ id: 'wati', name: 'Chef Wati' }]);
    expect(menu.items.find((candidate) => candidate.id === 'lemper')?.chefId).toBe('wati');
  });
});

describe('customer orders', () => {
  it('creates an ordered order with a snapshot, code, token and one audit entry', () => {
    const order = expectOk(
      store.createOrder(req([{ itemId: 'ayam-goreng', qty: 2 }], { note: 'extra spicy' })),
    );
    expect(parseOrder(order)).not.toBeNull();
    expect(order).toMatchObject({
      status: 'ordered',
      paid: false,
      firstName: 'Rina',
      note: 'extra spicy',
    });
    expect(order.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(order.token.length * 6).toBeGreaterThanOrEqual(128);
    expect(order.lines[0]).toMatchObject({ priceCents: 1250, qty: 2, size: { en: '250 g' } });
    expect(order.audit).toHaveLength(1);
    expect(order.audit[0]).toMatchObject({
      by: { role: 'customer', name: 'Rina' },
      what: 'created',
    });
    expect(order.enteredBy).toBeUndefined();
  });

  it('rejects unknown items', () => {
    expect(store.createOrder(one('nope'))).toMatchObject({ ok: false, error: 'unknown_item' });
  });

  it('refuses a draft week', () => {
    store.setWeek({ status: 'draft' });
    expect(store.createOrder(one('pesmol'))).toMatchObject({
      ok: false,
      error: 'week_not_published',
    });
  });
});

describe('portion limits', () => {
  it('refuses more than remaining, then sells out at the limit', () => {
    expect(store.createOrder(one('empek-empek', 11))).toMatchObject({
      ok: false,
      error: 'exceeds_remaining',
    });
    expectOk(store.createOrder(one('empek-empek', 9)));
    expect(item('empek-empek')).toMatchObject({ remaining: 1, soldOut: false });
    expectOk(store.createOrder(one('empek-empek')));
    expect(item('empek-empek')).toMatchObject({ remaining: 0, soldOut: true });
    expect(store.createOrder(one('empek-empek'))).toMatchObject({ ok: false, error: 'sold_out' });
  });

  it('frees portions on cancel, and lets an order keep its own portions when edited', () => {
    const order = expectOk(store.createOrder(one('empek-empek', 10)));
    expect(
      store.updateOrder(order.token, { lines: [{ itemId: 'empek-empek', qty: 10 }] }),
    ).toMatchObject({ ok: true });
    expectOk(store.cancelOrder(order.token));
    expect(item('empek-empek')?.remaining).toBe(10);
  });

  it('applies to seller-entered orders too', () => {
    expect(store.createSellerOrder(one('lemper', 21), staff)).toMatchObject({
      ok: false,
      error: 'exceeds_remaining',
    });
  });
});

describe('cut-off (injected clock)', () => {
  it('refuses create, update and cancel after the cut-off', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    clock = AFTER;
    expect(store.createOrder(one('pesmol'))).toMatchObject({ ok: false, error: 'cutoff_passed' });
    expect(store.updateOrder(order.token, { note: 'x' })).toMatchObject({
      ok: false,
      error: 'cutoff_passed',
    });
    expect(store.cancelOrder(order.token)).toMatchObject({ ok: false, error: 'cutoff_passed' });
  });

  it('accepts one second before the cut-off', () => {
    clock = new Date('2026-10-09T08:59:59Z');
    expect(store.createOrder(one('pesmol'))).toMatchObject({ ok: true });
  });

  it('still lets the seller change status and enter orders after the cut-off', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    clock = AFTER;
    expect(store.setStatus(order.code, 'confirmed', staff)).toMatchObject({ ok: true });
    expect(store.createSellerOrder(one('pesmol'), staff)).toMatchObject({ ok: true });
  });
});

describe('customer changes', () => {
  it('edits lines, fulfilment and note, and clears the note', () => {
    const order = expectOk(store.createOrder(req([{ itemId: 'pesmol', qty: 1 }], { note: 'a' })));
    const updated = expectOk(
      store.updateOrder(order.token, {
        lines: [
          { itemId: 'pesmol', qty: 3 },
          { itemId: 'tempe-mendoan', qty: 1 },
        ],
        fulfilment: 'delivery',
        note: '',
      }),
    );
    expect(updated.lines.map((line) => [line.itemId, line.qty])).toEqual([
      ['pesmol', 3],
      ['tempe-mendoan', 1],
    ]);
    expect(updated.fulfilment).toBe('delivery');
    expect(updated).not.toHaveProperty('note');
    expect(updated.audit[0]).toMatchObject({ what: 'edited' });
  });

  it('refuses changes to a closed order and unknown tokens', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    expectOk(store.cancelOrder(order.token));
    expect(store.updateOrder(order.token, { note: 'x' })).toMatchObject({
      ok: false,
      error: 'invalid_status',
    });
    expect(store.cancelOrder(order.token)).toMatchObject({ ok: false, error: 'invalid_status' });
    expect(store.updateOrder('nope', { note: 'x' })).toMatchObject({
      ok: false,
      error: 'not_found',
    });
  });
});

describe('snapshots (D-020)', () => {
  it('keeps the ordered name, size and price when the item is edited later', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    store.updateItem('pesmol', { priceCents: 2000, name: { en: 'New name', id: 'Nama baru' } });
    expect(store.getByToken(order.token)?.lines[0]).toMatchObject({
      priceCents: 1500,
      name: { en: 'Tilapia pesmol' },
    });
    // an edit that keeps the line keeps its snapshot; a new order gets the new price
    const updated = expectOk(
      store.updateOrder(order.token, { lines: [{ itemId: 'pesmol', qty: 2 }] }),
    );
    expect(updated.lines[0]).toMatchObject({ priceCents: 1500, qty: 2 });
    const fresh = expectOk(store.createOrder(one('pesmol')));
    expect(fresh.lines[0]).toMatchObject({ priceCents: 2000, name: { en: 'New name' } });
  });
});

describe('seller side', () => {
  it('starts seller- and chef-entered orders as confirmed with enteredBy and audit', () => {
    const chef = { role: 'chef', name: 'Wati' } as const;
    const bySeller = expectOk(store.createSellerOrder(one('pesmol'), staff));
    const byChef = expectOk(store.createSellerOrder(one('pesmol'), chef));
    expect(bySeller).toMatchObject({ status: 'confirmed', enteredBy: staff });
    expect(byChef).toMatchObject({ status: 'confirmed', enteredBy: chef });
    expect(byChef.audit[0]?.by).toEqual(chef);
  });

  it('only allows statuses from nextStatuses', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    expect(store.setStatus(order.code, 'collected', staff)).toMatchObject({
      ok: false,
      error: 'invalid_status',
    });
    expect(store.setStatus('NOPE22', 'confirmed', staff)).toMatchObject({
      ok: false,
      error: 'not_found',
    });
    expectOk(store.setStatus(order.code, 'confirmed', staff));
    expectOk(store.setStatus(order.code, 'ready_for_pickup', staff));
    expect(expectOk(store.setStatus(order.code, 'collected', staff)).status).toBe('collected');
    expect(store.setStatus(order.code, 'cancelled', staff)).toMatchObject({
      ok: false,
      error: 'invalid_status',
    });
  });

  it('keeps only the last 4 audit entries, newest first', () => {
    const order = expectOk(store.createOrder(one('pesmol')));
    expectOk(store.setStatus(order.code, 'confirmed', staff));
    expectOk(store.setPaid(order.code, true, staff));
    expectOk(store.setStatus(order.code, 'ready_for_pickup', staff));
    expectOk(store.setPaid(order.code, false, staff));
    const last = expectOk(store.setStatus(order.code, 'collected', staff));
    expect(last.audit).toHaveLength(4);
    expect(last.audit.map((entry) => `${entry.what}:${entry.detail}`)).toEqual([
      'status:collected',
      'paid:unpaid',
      'status:ready_for_pickup',
      'paid:paid',
    ]);
    expect(last.paid).toBe(false);
  });

  it('lists newest first and finds by code', () => {
    const a = expectOk(store.createOrder(one('pesmol')));
    const b = expectOk(store.createOrder(one('pesmol')));
    expect(store.listOrders().map((order) => order.id)).toEqual([b.id, a.id]);
    expect(store.getByCode(a.code)?.id).toBe(a.id);
  });
});

describe('addSampleOrders', () => {
  const names = ['Rina', 'Tom', 'Sari', 'Budi', 'Mei', 'Dewi', 'Arif', 'Lisa'];

  it('is deterministic and valid', () => {
    const other = createStore({ now: () => clock });
    expect(store.addSampleOrders(12)).toBe(12);
    other.addSampleOrders(12);
    expect(store.listOrders()).toEqual(other.listOrders());
    for (const order of store.listOrders()) {
      expect(parseOrder(order)).not.toBeNull();
      expect(names).toContain(order.firstName);
    }
    expect(new Set(store.listOrders().map((order) => order.code)).size).toBe(12);
  });

  it('never exceeds portion limits', () => {
    store.addSampleOrders(100);
    for (const view of store.getMenu().items) {
      expect(view.remaining === null || view.remaining >= 0).toBe(true);
    }
  });

  it('reset restores the fixture', () => {
    store.addSampleOrders(5);
    store.updateItem('pesmol', { priceCents: 1 });
    store.reset();
    expect(store.listOrders()).toEqual([]);
    expect(item('pesmol')?.priceCents).toBe(1500);
  });
});
