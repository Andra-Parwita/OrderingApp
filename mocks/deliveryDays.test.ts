// @vitest-environment node
// Plan 126: delivery on another day. The menu's delivery days, the default day, the order's day, the
// seller-side routes and the automatic finish time. Against a local D1.
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../shared/dates';
import type { CreateOrderRequest } from '../shared/orderContract';
import { finishDueMenus } from '../worker/db/menus';
import type { SellerRepository } from '../worker/repo/Repository';
import { useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const staff = { role: 'seller', name: 'Bu Ani' } as const;
const NOTE = { en: 'After 1 pm', id: 'Setelah jam 1' };

function req(overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'delivery',
    lines: [{ itemId: 'pesmol', qty: 1 }],
    ...overrides,
  };
}

describe('delivery days (plan 126)', () => {
  const create = useWorld('delivery-days');
  let world: World;
  let store: SellerRepository;
  let cooking = '';

  async function setDelivery(days?: Array<string>, defaultDay?: string) {
    return store.updateMenu({
      delivery: {
        available: true,
        note: NOTE,
        ...(days !== undefined ? { days } : {}),
        ...(defaultDay !== undefined ? { defaultDay } : {}),
      },
    });
  }
  const day = (offset: number) => addDays(cooking, offset);

  beforeEach(async () => {
    world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
    store = (await world.repo.sellerBySlug('onde-onde')) as SellerRepository;
    const row = await world.db
      .stmt('SELECT cooking_date FROM menus WHERE seller_id = ?', SELLER_ID)
      .first<{ cooking_date: string }>();
    cooking = row?.cooking_date ?? '';
    await world.db
      .stmt('UPDATE menus SET delivery_available = 1 WHERE seller_id = ?', SELLER_ID)
      .run();
  });

  describe('saving the days', () => {
    it('accepts 2 before, the event day and 1 after, with the default among them', async () => {
      const saved = await setDelivery([day(-2), day(-1), day(0), day(1)], day(-1));
      expect(saved).toMatchObject({ ok: true });
      if (!saved.ok) return;
      expect(saved.value.menu.menu.delivery).toMatchObject({
        days: [day(-2), day(-1), day(0), day(1)],
        defaultDay: day(-1),
      });
    });

    it('refuses a day 3 before, 2 after, a duplicate or a bad default', async () => {
      for (const bad of [[day(-3)], [day(2)], [day(0), day(0)]]) {
        expect(await setDelivery(bad)).toMatchObject({ ok: false, error: 'invalid_request' });
      }
      expect(await setDelivery([day(0), day(1)], day(-1))).toMatchObject({
        ok: false,
        error: 'invalid_request',
      });
    });

    it('lets the event day be unticked when another day is the default', async () => {
      const saved = await setDelivery([day(-1), day(1)], day(-1));
      expect(saved).toMatchObject({ ok: true });
      if (!saved.ok) return;
      expect(saved.value.menu.menu.delivery.days).toEqual([day(-1), day(1)]);
    });

    it('stores only the event day as nothing (today)', async () => {
      const saved = await setDelivery([day(0)]);
      expect(saved).toMatchObject({ ok: true });
      if (!saved.ok) return;
      expect(saved.value.menu.menu.delivery.days).toBeUndefined();
    });

    it('clears the days when delivery is switched off', async () => {
      await setDelivery([day(-1), day(0)]);
      const off = await store.updateMenu({ delivery: { available: false, note: NOTE } });
      expect(off).toMatchObject({ ok: true });
      if (!off.ok) return;
      expect(off.value.menu.menu.delivery.days).toBeUndefined();
      const on = await store.updateMenu({ delivery: { available: true, note: NOTE } });
      if (!on.ok) return;
      expect(on.value.menu.menu.delivery.days).toBeUndefined();
    });

    it('can be changed while the menu is live', async () => {
      await world.db.stmt("UPDATE menus SET state = 'live' WHERE seller_id = ?", SELLER_ID).run();
      expect(await setDelivery([day(0), day(1)])).toMatchObject({ ok: true });
      expect(await setDelivery([day(0)])).toMatchObject({ ok: true });
    });

    it('drops days that fall out of range when the cooking day moves', async () => {
      await setDelivery([day(-2), day(0), day(1)]);
      const moved = await store.updateMenu({ cookingDate: addDays(cooking, 2) });
      if (!moved.ok) throw new Error(moved.message);
      // Cooking day + 2: only day(0) and day(1) are still within 2 before / 1 after.
      expect(moved.value.menu.menu.delivery.days).toEqual([day(0), day(1)]);
    });
  });

  describe('placing an order', () => {
    it('accepts a day of the menu and refuses others, pickup or no delivery', async () => {
      await setDelivery([day(0), day(1)]);
      const ok = await store.createOrder(req({ handoverDate: day(1) }));
      expect(ok).toMatchObject({ ok: true });
      if (ok.ok) expect(ok.value.handoverDate).toBe(day(1));
      expect(await store.createOrder(req({ handoverDate: day(-1) }))).toMatchObject({
        ok: false,
        error: 'invalid_request',
      });
      expect(
        await store.createOrder(req({ fulfilment: 'pickup', handoverDate: day(1) })),
      ).toMatchObject({ ok: false, error: 'invalid_request' });
    });

    it('without a day: the event day stores nothing, another default is stored', async () => {
      const plain = await store.createOrder(req());
      expect(plain).toMatchObject({ ok: true });
      if (plain.ok) expect(plain.value.handoverDate).toBeUndefined();
      await setDelivery([day(-1), day(0)], day(-1));
      const withDefault = await store.createOrder(req());
      if (!withDefault.ok) throw new Error(withDefault.message);
      expect(withDefault.value.handoverDate).toBe(day(-1));
      // The event day, chosen on purpose, is stored as nothing.
      const event = await store.createOrder(req({ handoverDate: day(0) }));
      if (!event.ok) throw new Error(event.message);
      expect(event.value.handoverDate).toBeUndefined();
    });

    it('the seller enters an order with the same rules', async () => {
      await setDelivery([day(0), day(1)]);
      const made = await store.createSellerOrder(req({ handoverDate: day(1) }), staff);
      if (!made.ok) throw new Error(made.message);
      expect(made.value.handoverDate).toBe(day(1));
      expect(await store.createSellerOrder(req({ handoverDate: day(-2) }), staff)).toMatchObject({
        ok: false,
        error: 'invalid_request',
      });
    });

    it('a day removed from the menu later leaves the order as it was', async () => {
      await setDelivery([day(0), day(1)]);
      const made = await store.createOrder(req({ handoverDate: day(1) }));
      if (!made.ok) throw new Error(made.message);
      await setDelivery([day(0)]);
      const row = await world.db
        .stmt('SELECT handover_date FROM orders WHERE token = ?', made.value.token)
        .first<{ handover_date: string | null }>();
      expect(row?.handover_date).toBe(day(1));
    });
  });

  describe('changing one order (seller)', () => {
    const address = { street: '12 Jetty Rd', suburb: 'Glenelg', postcode: '5045' };

    it('sets the order day from the menu, keeps its own removed day, refuses others', async () => {
      await setDelivery([day(0), day(1)]);
      const made = await store.createOrder(req({ handoverDate: day(1) }));
      if (!made.ok) throw new Error(made.message);
      await setDelivery([day(0), day(-1)]);
      const own = await store.changeFulfilment(
        made.value.code,
        { fulfilment: 'delivery', address, notify: false, handoverDate: day(1) },
        staff,
      );
      expect(own).toMatchObject({ ok: true });
      const moved = await store.changeFulfilment(
        made.value.code,
        { fulfilment: 'delivery', address, notify: false, handoverDate: day(-1) },
        staff,
      );
      if (!moved.ok) throw new Error(moved.message);
      expect(moved.value.handoverDate).toBe(day(-1));
      const bad = await store.changeFulfilment(
        made.value.code,
        { fulfilment: 'delivery', address, notify: false, handoverDate: day(-2) },
        staff,
      );
      expect(bad).toMatchObject({ ok: false, error: 'invalid_request' });
    });

    it('pickup drops the day', async () => {
      await setDelivery([day(0), day(1)]);
      const made = await store.createOrder(req({ handoverDate: day(1) }));
      if (!made.ok) throw new Error(made.message);
      const placeId = (
        await world.db
          .stmt('SELECT place_id FROM menu_pickup_places WHERE seller_id = ?', SELLER_ID)
          .first<{ place_id: string }>()
      )?.place_id;
      const back = await store.changeFulfilment(
        made.value.code,
        { fulfilment: 'pickup', pickupPlaceId: placeId ?? '', notify: false },
        staff,
      );
      if (!back.ok) throw new Error(back.message);
      expect(back.value.handoverDate).toBeUndefined();
    });
  });

  describe('the automatic finish', () => {
    async function finishedAt(now: string): Promise<boolean> {
      await world.db.stmt("UPDATE menus SET state = 'live' WHERE seller_id = ?", SELLER_ID).run();
      await finishDueMenus(world.db, new Date(now));
      const row = await world.db
        .stmt('SELECT state FROM menus WHERE seller_id = ?', SELLER_ID)
        .first<{ state: string }>();
      return row?.state === 'finished';
    }

    it('waits for midnight after the latest delivery day', async () => {
      await setDelivery([day(0), day(1)]);
      // Midnight after the event day (UTC is close enough for the kitchen's zone, +/- 14 h).
      expect(await finishedAt(`${day(1)}T01:00:00Z`)).toBe(false);
      expect(await finishedAt(`${day(3)}T12:00:00Z`)).toBe(true);
    });

    it('"keep the menu open 1 more day" waits one day more; old menus default to off', async () => {
      const row = await world.db
        .stmt('SELECT finish_extra_day FROM menus WHERE seller_id = ?', SELLER_ID)
        .first<{ finish_extra_day: number }>();
      expect(row?.finish_extra_day).toBe(0);
      const set = await store.updateMenu({ finishExtraDay: true });
      if (!set.ok) throw new Error(set.message);
      expect(set.value.menu.menu.finishExtraDay).toBe(true);
      expect(await finishedAt(`${day(1)}T12:00:00Z`)).toBe(false);
      expect(await finishedAt(`${day(3)}T12:00:00Z`)).toBe(true);
    });
  });
});
