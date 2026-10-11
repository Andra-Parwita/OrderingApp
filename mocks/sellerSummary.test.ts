// @vitest-environment node
// Plan 038 stage 3: the admin seller list carries a summary per kitchen (counts and dates only).
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import type { SellerRepository, StoreResult } from '../worker/repo/Repository';
import { useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z'); // Wed 7 Oct; the sample menus cook Sat 10 Oct

function expectOk<T>(result: StoreResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.value;
}

describe('admin seller summary', () => {
  const create = useWorld('sellerSummary');
  let world: World;
  let store: SellerRepository;

  beforeEach(async () => {
    world = await create({ now: () => NOW });
    store = (await world.repo.sellerBySlug('onde-onde')) as SellerRepository;
  });

  const summaryOf = async (slug: string) =>
    (await world.repo.adminSellers()).find((seller) => seller.slug === slug)?.summary;

  it('reads a live menu with 3 orders, and leaves cancelled ones out', async () => {
    const line = [{ itemId: 'pesmol', qty: 1 }];
    const make = (firstName: string) =>
      store.createOrder({ firstName, language: 'en', fulfilment: 'pickup', lines: line });
    expectOk(await make('Rina'));
    expectOk(await make('Tono'));
    expectOk(await make('Wati'));
    const gone = expectOk(await make('Budi'));
    expectOk(await store.cancelOrder(gone.token));
    expect(await summaryOf('onde-onde')).toMatchObject({
      menu: { state: 'live', cookingDate: '2026-10-10' },
      orders: 3,
    });
  });

  it('counts people and the newest device use; a kitchen with none reads empty', async () => {
    const issued = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: 'seller-onde-onde',
      displayName: 'Bu Ani',
    });
    const started = await world.repo.auth.redeemKey(issued.key, 'dev-0-abcd-efgh');
    if (!started.ok) throw new Error(started.error);
    const done = await world.repo.auth.register(started.value.token, {
      kind: 'password',
      password: 'long enough password',
      deviceName: 'Phone',
    });
    if (!done.ok) throw new Error(done.error);
    const summary = await summaryOf('onde-onde');
    expect(summary?.people).toBe(1);
    expect(summary?.lastActiveAt).not.toBeNull();

    const fresh = await world.repo.addSeller('Warung Baru', 'warung-baru');
    expect(fresh.summary).toBeUndefined();
    const listed = (await summaryOf('warung-baru')) ?? null;
    expect(listed === null || (listed.people === 0 && listed.lastActiveAt === null)).toBe(true);
    expect(listed?.menu ?? null).not.toMatchObject({ state: 'live' });
  });
});
