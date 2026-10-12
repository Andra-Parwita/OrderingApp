// @vitest-environment node
// A customer may only pick what the menu offers; the seller keeps entering either. Against a local D1.
import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateOrderRequest } from '../shared/orderContract';
import type { SellerRepository } from '../worker/repo/Repository';
import { useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const staff = { role: 'seller', name: 'Bu Ani' } as const;

function req(fulfilment: 'pickup' | 'delivery'): CreateOrderRequest {
  return {
    firstName: 'Rina',
    language: 'en',
    fulfilment,
    lines: [{ itemId: 'pesmol', qty: 1 }],
  };
}

describe('fulfilment the menu offers', () => {
  const create = useWorld('fulfilment-offered');
  let world: World;
  let store: SellerRepository;

  async function setMenu(pickup: boolean, delivery: boolean) {
    if (!pickup) {
      await world.db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', SELLER_ID).run();
    }
    await world.db
      .stmt(
        'UPDATE menus SET delivery_available = ? WHERE seller_id = ?',
        delivery ? 1 : 0,
        SELLER_ID,
      )
      .run();
  }

  beforeEach(async () => {
    world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
    store = (await world.repo.sellerBySlug('onde-onde')) as SellerRepository;
  });

  it('delivery-only: customer pickup is refused, delivery is fine', async () => {
    await setMenu(false, true);
    expect(await store.createOrder(req('pickup'))).toMatchObject({
      ok: false,
      error: 'fulfilment_unavailable',
    });
    expect(await store.createOrder(req('delivery'))).toMatchObject({ ok: true });
  });

  it('pickup-only: customer delivery is refused, seller-entered delivery is fine', async () => {
    await setMenu(true, false);
    expect(await store.createOrder(req('delivery'))).toMatchObject({
      ok: false,
      error: 'fulfilment_unavailable',
    });
    expect(await store.createOrder(req('pickup'))).toMatchObject({ ok: true });
    expect(await store.createSellerOrder(req('delivery'), staff)).toMatchObject({ ok: true });
  });

  it('a customer edit that flips to an unavailable fulfilment is refused', async () => {
    await setMenu(true, true);
    const made = await store.createOrder(req('pickup'));
    if (!made.ok) throw new Error(made.message);
    await setMenu(true, false);
    expect(await store.updateOrder(made.value.token, { fulfilment: 'delivery' })).toMatchObject({
      ok: false,
      error: 'fulfilment_unavailable',
    });
    expect(await store.updateOrder(made.value.token, { fulfilment: 'pickup' })).toMatchObject({
      ok: true,
    });
  });
});
