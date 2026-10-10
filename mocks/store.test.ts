// @vitest-environment node
// The seller repository rules (limits, cut-off, customer changes, seller actions, sample orders),
// against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseMenuResponse } from '../shared/menuContract';
import { parseOrder, type CreateOrderRequest } from '../shared/orderContract';
import type { SellerRepository, StoreResult } from '../worker/repo/Repository';
import { useWorld, type World } from './impl';

const BEFORE = new Date('2026-10-07T10:00:00Z');
const AFTER = new Date('2026-10-09T10:00:01Z'); // 21:00:01 Melbourne (+11:00)
const ONDE_ID = 'seller-onde-onde';

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

describe('seller rules', () => {
  const create = useWorld('store');
  let clock = BEFORE;
  let world: World;
  let store: SellerRepository;

  const sellerOf = async () => (await world.repo.sellerBySlug('onde-onde')) as SellerRepository;
  const item = async (id: string) =>
    (await store.getMenu()).items.find((candidate) => candidate.id === id);
  const byToken = async (token: string) => {
    const hit = await world.repo.lookupByToken(token);
    return hit?.kind === 'live' ? hit.order : undefined;
  };

  beforeEach(async () => {
    clock = BEFORE;
    world = await create({ now: () => clock });
    store = await sellerOf();
  });

  describe('menu', () => {
    it('is the seeded fixture and matches the contract', async () => {
      const menu = await store.getMenu();
      expect(parseMenuResponse(menu)).not.toBeNull();
      expect(menu.kitchen.name).toBe('Onde Onde');
      expect(menu.items).toHaveLength(6);
      expect(await item('lemper')).toMatchObject({ limit: 20, remaining: 20 });
      expect(await item('lemper')).not.toHaveProperty('chefId');
      expect(menu).not.toHaveProperty('chefs');
    });

    it('gives the seller the chefs and chef ids', async () => {
      const menu = await store.getSellerMenu();
      expect(menu.chefs).toEqual([{ id: 'wati', sellerId: ONDE_ID, name: 'Chef Wati' }]);
      expect(menu.items.find((candidate) => candidate.id === 'lemper')?.chefId).toBe('wati');
    });
  });

  describe('customer orders', () => {
    it('creates an ordered order with a snapshot, code, token and one audit entry', async () => {
      const order = expectOk(
        await store.createOrder(req([{ itemId: 'ayam-goreng', qty: 2 }], { note: 'extra spicy' })),
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
      // What was stored reads back the same.
      expect(await store.getByCode(order.code)).toEqual(order);
    });

    it('rejects unknown items', async () => {
      expect(await store.createOrder(one('nope'))).toMatchObject({
        ok: false,
        error: 'unknown_item',
      });
    });

    it('refuses a draft week', async () => {
      await store.unpublishMenu();
      expect(await store.createOrder(one('pesmol'))).toMatchObject({
        ok: false,
        error: 'week_not_published',
      });
    });
  });

  describe('portion limits', () => {
    it('refuses more than remaining, then sells out at the limit', async () => {
      expect(await store.createOrder(one('empek-empek', 11))).toMatchObject({
        ok: false,
        error: 'exceeds_remaining',
      });
      expectOk(await store.createOrder(one('empek-empek', 9)));
      expect(await item('empek-empek')).toMatchObject({ remaining: 1, soldOut: false });
      expectOk(await store.createOrder(one('empek-empek')));
      expect(await item('empek-empek')).toMatchObject({ remaining: 0, soldOut: true });
      expect(await store.createOrder(one('empek-empek'))).toMatchObject({
        ok: false,
        error: 'sold_out',
      });
    });

    it('frees portions on cancel, and lets an order keep its own portions when edited', async () => {
      const order = expectOk(await store.createOrder(one('empek-empek', 10)));
      expect(
        await store.updateOrder(order.token, { lines: [{ itemId: 'empek-empek', qty: 10 }] }),
      ).toMatchObject({ ok: true });
      expectOk(await store.cancelOrder(order.token));
      expect((await item('empek-empek'))?.remaining).toBe(10);
    });

    it('applies to seller-entered orders too', async () => {
      expect(await store.createSellerOrder(one('lemper', 21), staff)).toMatchObject({
        ok: false,
        error: 'exceeds_remaining',
      });
    });
  });

  describe('cut-off (injected clock)', () => {
    it('refuses create, update and cancel after the cut-off', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      clock = AFTER;
      expect(await store.createOrder(one('pesmol'))).toMatchObject({
        ok: false,
        error: 'cutoff_passed',
      });
      expect(await store.updateOrder(order.token, { note: 'x' })).toMatchObject({
        ok: false,
        error: 'cutoff_passed',
      });
      expect(await store.cancelOrder(order.token)).toMatchObject({
        ok: false,
        error: 'cutoff_passed',
      });
    });

    it('accepts one second before the cut-off', async () => {
      clock = new Date('2026-10-09T08:59:59Z');
      expect(await store.createOrder(one('pesmol'))).toMatchObject({ ok: true });
    });

    it('still lets the seller change status and enter orders after the cut-off', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      clock = AFTER;
      expect(await store.setStatus(order.code, 'confirmed', staff)).toMatchObject({ ok: true });
      expect(await store.createSellerOrder(one('pesmol'), staff)).toMatchObject({ ok: true });
    });
  });

  describe('customer changes', () => {
    it('edits lines, fulfilment and note, and clears the note', async () => {
      const order = expectOk(
        await store.createOrder(req([{ itemId: 'pesmol', qty: 1 }], { note: 'a' })),
      );
      const updated = expectOk(
        await store.updateOrder(order.token, {
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
      expect(await store.getByCode(order.code)).toEqual(updated);
    });

    it('refuses changes to a closed order and unknown tokens', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      expectOk(await store.cancelOrder(order.token));
      expect(await store.updateOrder(order.token, { note: 'x' })).toMatchObject({
        ok: false,
        error: 'invalid_status',
      });
      expect(await store.cancelOrder(order.token)).toMatchObject({
        ok: false,
        error: 'invalid_status',
      });
      expect(await store.updateOrder('nope', { note: 'x' })).toMatchObject({
        ok: false,
        error: 'not_found',
      });
    });
  });

  describe('snapshots (D-020)', () => {
    it('keeps the ordered name, size and price when the item is edited later', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      expectOk(
        await store.patchItem('pesmol', {
          priceCents: 2000,
          name: { en: 'New name', id: 'Nama baru' },
        }),
      );
      expect((await byToken(order.token))?.lines[0]).toMatchObject({
        priceCents: 1500,
        name: { en: 'Tilapia pesmol' },
      });
      // an edit that keeps the line keeps its snapshot; a new order gets the new price
      const updated = expectOk(
        await store.updateOrder(order.token, { lines: [{ itemId: 'pesmol', qty: 2 }] }),
      );
      expect(updated.lines[0]).toMatchObject({ priceCents: 1500, qty: 2 });
      const fresh = expectOk(await store.createOrder(one('pesmol')));
      expect(fresh.lines[0]).toMatchObject({ priceCents: 2000, name: { en: 'New name' } });
    });
  });

  describe('seller side', () => {
    it('starts seller- and chef-entered orders as confirmed with enteredBy and audit', async () => {
      const chef = { role: 'chef', name: 'Wati' } as const;
      const bySeller = expectOk(await store.createSellerOrder(one('pesmol'), staff));
      const byChef = expectOk(await store.createSellerOrder(one('pesmol'), chef));
      expect(bySeller).toMatchObject({ status: 'confirmed', enteredBy: staff });
      expect(byChef).toMatchObject({ status: 'confirmed', enteredBy: chef });
      expect(byChef.audit[0]?.by).toEqual(chef);
    });

    it('only allows statuses from nextStatuses', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      expect(await store.setStatus(order.code, 'collected', staff)).toMatchObject({
        ok: false,
        error: 'invalid_status',
      });
      expect(await store.setStatus('NOPE22', 'confirmed', staff)).toMatchObject({
        ok: false,
        error: 'not_found',
      });
      expectOk(await store.setStatus(order.code, 'confirmed', staff));
      expectOk(await store.setStatus(order.code, 'ready_for_pickup', staff));
      expect(expectOk(await store.setStatus(order.code, 'collected', staff)).status).toBe(
        'collected',
      );
      expect(await store.setStatus(order.code, 'cancelled', staff)).toMatchObject({
        ok: false,
        error: 'invalid_status',
      });
    });

    it('keeps only the last 4 audit entries, newest first', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      expectOk(await store.setStatus(order.code, 'confirmed', staff));
      expectOk(await store.setPaid(order.code, true, staff));
      expectOk(await store.setStatus(order.code, 'ready_for_pickup', staff));
      expectOk(await store.setPaid(order.code, false, staff));
      const last = expectOk(await store.setStatus(order.code, 'collected', staff));
      expect(last.audit).toHaveLength(4);
      expect(last.audit.map((entry) => `${entry.what}:${entry.detail}`)).toEqual([
        'status:collected',
        'paid:unpaid',
        'status:ready_for_pickup',
        'paid:paid',
      ]);
      expect(last.paid).toBe(false);
      // The database kept the same four.
      expect((await store.getByCode(order.code))?.audit).toEqual(last.audit);
    });

    it('lists newest first and finds by code', async () => {
      const a = expectOk(await store.createOrder(one('pesmol')));
      const b = expectOk(await store.createOrder(one('pesmol')));
      expect((await store.listOrders()).map((order) => order.id)).toEqual([b.id, a.id]);
      expect((await store.getByCode(a.code))?.id).toBe(a.id);
    });
  });

  describe('addSampleOrders', () => {
    const names = ['Rina', 'Tom', 'Sari', 'Budi', 'Mei', 'Dewi', 'Arif', 'Lisa'];

    it('is deterministic and valid', async () => {
      expect(await world.repo.dev.addSampleOrders(ONDE_ID, 12)).toEqual({ added: 12 });
      const first = await store.listOrders();
      await world.reset();
      store = await sellerOf();
      await world.repo.dev.addSampleOrders(ONDE_ID, 12);
      expect(await store.listOrders()).toEqual(first);
      for (const order of first) {
        expect(parseOrder(order)).not.toBeNull();
        expect(names).toContain(order.firstName);
      }
      expect(new Set(first.map((order) => order.code)).size).toBe(12);
    });

    it('never exceeds portion limits', async () => {
      await world.repo.dev.addSampleOrders(ONDE_ID, 100);
      for (const view of (await store.getMenu()).items) {
        expect(view.remaining === null || view.remaining >= 0).toBe(true);
      }
    });

    it('adds 50 across statuses, paid or not, delivery and repeat customers', async () => {
      await world.db.stmt('UPDATE menu_items SET portion_limit = NULL').run();
      expect(await world.repo.dev.addSampleOrders(ONDE_ID, 50)).toEqual({ added: 50 });
      const orders = await store.listOrders();
      expect(orders).toHaveLength(50);
      expect(new Set(orders.map((order) => order.status)).size).toBeGreaterThanOrEqual(5);
      expect(new Set(orders.map((order) => order.paid)).size).toBe(2);
      expect(orders.some((order) => order.returning)).toBe(true);
      expect(new Set(orders.map((order) => order.firstName)).size).toBeLessThan(50);
    });

    it('three taps in a row never error and never oversell; the last says sold out', async () => {
      await world.db.stmt('UPDATE menu_items SET portion_limit = 3').run();
      const answers = [];
      for (let tap = 0; tap < 3; tap++) {
        answers.push(await world.repo.dev.addSampleOrders(ONDE_ID, 50));
      }
      expect(answers[0]).toMatchObject({ reason: 'sold_out' });
      expect(answers[0]?.added).toBeGreaterThan(0);
      expect(answers[2]).toEqual({ added: 0, reason: 'sold_out' });
      const taken = new Map<string, number>();
      for (const order of await store.listOrders()) {
        if (order.status === 'cancelled') continue;
        for (const line of order.lines) {
          taken.set(line.itemId, (taken.get(line.itemId) ?? 0) + line.qty);
        }
      }
      for (const qty of taken.values()) expect(qty).toBeLessThanOrEqual(3);
    });

    it('follows the current menu: none after finish, then the new menu dishes and places', async () => {
      await world.db.stmt("UPDATE menus SET state = 'live'").run();
      expectOk(await store.finishMenuNow());
      expect(await world.repo.dev.addSampleOrders(ONDE_ID, 5)).toEqual({
        added: 0,
        reason: 'no_menu',
      });

      expectOk(await store.createMenu({}));
      const dish = expectOk(
        await store.createDish({ name: { en: 'Klepon', id: 'Klepon' }, priceCents: 900 }),
      );
      const place = (await store.listPickupPlaces())[1];
      expectOk(
        await store.updateMenu({ dishIds: [dish.id], places: [{ placeId: place?.id ?? '' }] }),
      );
      expect(await world.repo.dev.addSampleOrders(ONDE_ID, 5)).toEqual({ added: 5 });
      const orders = (await store.listOrders()).filter((order) => order.id.startsWith('sample-'));
      expect(orders).toHaveLength(5);
      for (const order of orders) {
        expect(order.lines.map((line) => line.name.en)).toContain('Klepon');
        if (order.fulfilment === 'pickup') expect(order.pickupPlaceId).toBe(place?.id);
      }
    });

    it('reset restores the fixture', async () => {
      await world.repo.dev.addSampleOrders(ONDE_ID, 5);
      expectOk(await store.patchItem('pesmol', { priceCents: 1 }));
      await world.reset();
      store = await sellerOf();
      expect(await store.listOrders()).toEqual([]);
      expect((await item('pesmol'))?.priceCents).toBe(1500);
    });
  });
});
