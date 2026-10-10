// @vitest-environment node
// Seller actions on orders: lock, changed flag and audit diff, inbox, seller-entered options,
// settings and the ordering switch, sample orders. Against
// a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest } from '../shared/orderContract';
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

describe('order actions', () => {
  const create = useWorld('batch2');
  let clock = BEFORE;
  let world: World;
  let store: SellerRepository;

  beforeEach(async () => {
    clock = BEFORE;
    world = await create({ now: () => clock });
    store = (await world.repo.sellerBySlug('onde-onde')) as SellerRepository;
  });

  describe('lock (D-027)', () => {
    it('blocks customer edit and cancel but not seller actions', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      const locked = expectOk(await store.setLocked(order.code, true));
      expect(locked.locked).toBe(true);
      expect(await store.updateOrder(order.token, { note: 'x' })).toMatchObject({
        ok: false,
        error: 'order_locked',
      });
      expect(await store.cancelOrder(order.token)).toMatchObject({
        ok: false,
        error: 'order_locked',
      });
      expect(await store.setStatus(order.code, 'confirmed', staff)).toMatchObject({ ok: true });
      expect(await store.setPaid(order.code, true, staff)).toMatchObject({ ok: true });
      expect(await store.nudge(order.code)).toMatchObject({ ok: true });
      expect(expectOk(await store.setLocked(order.code, false)).locked).toBe(false);
      expect(await store.updateOrder(order.token, { note: 'x' })).toMatchObject({ ok: true });
    });

    it('lets the seller lock after the cut-off', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      clock = AFTER;
      expect(await store.setLocked(order.code, true)).toMatchObject({ ok: true });
      expect(await store.setWaReceived(order.code, true)).toMatchObject({ ok: true });
    });
  });

  describe('changed flag and audit diff', () => {
    it('is set by a customer edit with a diff, and cleared by a status change', async () => {
      const order = expectOk(await store.createOrder(req([{ itemId: 'pesmol', qty: 1 }])));
      expect(order.changed).toBe(false);
      const edited = expectOk(
        await store.updateOrder(order.token, {
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
      expect(expectOk(await store.setStatus(order.code, 'confirmed', staff)).changed).toBe(false);
    });

    it('is cleared by seen, and an edit that changes nothing is not a change', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      const same = expectOk(
        await store.updateOrder(order.token, { lines: [{ itemId: 'pesmol', qty: 1 }] }),
      );
      expect(same.changed).toBe(false);
      expect(same.audit).toHaveLength(1);
      expect(expectOk(await store.updateOrder(order.token, { note: 'x' })).changed).toBe(true);
      expect(expectOk(await store.markSeen(order.code)).changed).toBe(false);
    });
  });

  describe('inbox', () => {
    it('records a status entry for creation and every status change', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      expect(order.inbox).toEqual([expect.objectContaining({ kind: 'status', status: 'ordered' })]);
      const moved = expectOk(await store.setStatus(order.code, 'confirmed', staff));
      expect(moved.inbox.map((entry) => entry.status)).toEqual(['confirmed', 'ordered']);
      const entered = expectOk(await store.createSellerOrder(one('pesmol'), staff));
      expect(entered.inbox[0]).toMatchObject({ kind: 'status', status: 'confirmed' });
    });

    it('nudge adds the key by returning, and is refused on a closed order', async () => {
      const fresh = expectOk(await store.createOrder(one('pesmol')));
      const back = expectOk(await store.createOrder({ ...one('pesmol'), returning: true }));
      expect(expectOk(await store.nudge(fresh.code)).inbox[0]).toMatchObject({
        kind: 'nudge',
        textKey: 'nudge',
      });
      expect(expectOk(await store.nudge(back.code)).inbox[0]).toMatchObject({
        kind: 'nudge',
        textKey: 'nudgeReturning',
      });
      expectOk(await store.cancelOrder(fresh.token));
      expect(await store.nudge(fresh.code)).toMatchObject({ ok: false, error: 'invalid_status' });
    });

    it('keeps the newest 20', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      for (let n = 0; n < 25; n++) expectOk(await store.nudge(order.code));
      const last = expectOk(await store.nudge(order.code));
      expect(last.inbox).toHaveLength(20);
      expect(last.inbox[0]?.kind).toBe('nudge');
      expect((await store.getByCode(order.code))?.inbox).toEqual(last.inbox);
    });
  });

  describe('seller-entered options (D-027)', () => {
    it('defaults to confirmed and unpaid, and is never returning', async () => {
      const order = expectOk(await store.createSellerOrder(one('pesmol'), staff));
      expect(order).toMatchObject({ status: 'confirmed', paid: false, returning: false });
    });

    it('honours confirmNow false and paid true', async () => {
      const order = expectOk(
        await store.createSellerOrder({ ...one('pesmol'), confirmNow: false, paid: true }, staff),
      );
      expect(order).toMatchObject({ status: 'ordered', paid: true, enteredBy: staff });
    });
  });

  describe('settings and ordering switch', () => {
    it('exposes the number and the open state on the menu', async () => {
      expect((await store.getMenu()).ordering).toEqual({ open: true });
      expect((await store.getMenu()).kitchen.whatsappNumber).toBeUndefined();
      await store.setSettings({ ...(await store.getSettings()), whatsappNumber: '61412345678' });
      expect((await store.getMenu()).kitchen.whatsappNumber).toBe('61412345678');
    });

    it('closes by the seller switch and refuses create, change and cancel', async () => {
      const order = expectOk(await store.createOrder(one('pesmol')));
      await store.setSettings({ ...(await store.getSettings()), orderingOpen: false });
      expect((await store.getMenu()).ordering).toEqual({
        open: false,
        reason: 'closed_by_seller',
      });
      expect(await store.createOrder(one('pesmol'))).toMatchObject({
        ok: false,
        error: 'ordering_closed',
      });
      expect(await store.updateOrder(order.token, { note: 'x' })).toMatchObject({
        ok: false,
        error: 'ordering_closed',
      });
      expect(await store.cancelOrder(order.token)).toMatchObject({
        ok: false,
        error: 'ordering_closed',
      });
      expect(await store.createSellerOrder(one('pesmol'), staff)).toMatchObject({ ok: true });
    });

    it('closes at the cut-off with the injected clock', async () => {
      clock = AFTER;
      expect((await store.getMenu()).ordering).toEqual({ open: false, reason: 'cutoff_passed' });
      await store.setSettings({ ...(await store.getSettings()), orderingOpen: false });
      expect((await store.getMenu()).ordering.reason).toBe('closed_by_seller');
    });
  });

  describe('sample orders (D-027 variety)', () => {
    it('include returning, changed with a diff, locked, notes and both fulfilments', async () => {
      await world.repo.dev.addSampleOrders(ONDE_ID, 60);
      const all = await store.listOrders();
      expect(all.some((order) => order.returning)).toBe(true);
      expect(all.some((order) => order.locked)).toBe(true);
      expect(all.some((order) => order.note !== undefined)).toBe(true);
      expect(new Set(all.map((order) => order.fulfilment)).size).toBe(2);
      const changed = all.filter((order) => order.changed);
      expect(changed.length).toBeGreaterThan(0);
      expect(changed.every((order) => order.audit[0]?.diff !== undefined)).toBe(true);
    });
  });
});
