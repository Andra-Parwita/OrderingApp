// @vitest-environment node
// Plan 129: a customer may change or cancel until 18:00 (kitchen time) the day before the cooking
// day, whatever the order cut-off is. Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { toInstant } from '../shared/zone';
import { addDays } from '../shared/dates';
import { useWorld, type World } from './impl';

describe('customer change deadline (plan 129)', () => {
  const create = useWorld('customer-change-deadline');
  let world: World;
  let clock = new Date('2026-10-07T10:00:00Z');
  let n = 0;

  const seller = async () => {
    const handle = await world.repo.sellerBySlug('onde-onde');
    if (!handle) throw new Error('no seller');
    return handle;
  };
  const place = async () => {
    const placed = await (
      await seller()
    ).createOrder({
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    if (!placed.ok) throw new Error(placed.error);
    return placed.value;
  };
  const week = async () => (await (await seller()).getMenu()).week;
  const zone = async () =>
    (await (await seller()).getMenu()).kitchen.timeZone ?? 'Australia/Adelaide';
  const evening = async () =>
    toInstant(addDays((await week()).cookingDate, -1), '18:00', await zone());

  beforeEach(async () => {
    n = 0;
    clock = new Date('2026-10-07T10:00:00Z');
    world = await create({
      now: () => clock,
      newToken: () => `token-${String(++n)}-padding-padding`,
    });
  });

  it('allows a change before 6 pm the day before, even after the cut-off', async () => {
    const order = await place();
    const w = await week();
    // 1 minute before the deadline, which is after the cut-off when the cut-off is at 9 am.
    await world.db
      .stmt(
        'UPDATE menus SET cutoff_at = ?',
        toInstant(addDays(w.cookingDate, -1), '15:00', await zone()),
      )
      .run();
    clock = new Date(Date.parse(await evening()) - 60_000);
    const changed = await (await seller()).updateOrder(order.token, { note: 'less spicy' });
    expect(changed.ok).toBe(true);
    expect((await (await seller()).cancelOrder(order.token)).ok).toBe(true);
  });

  it('refuses a change and a cancel from 6 pm the day before with changes_closed', async () => {
    const order = await place();
    clock = new Date(Date.parse(await evening()));
    const onde = await seller();
    expect(await onde.updateOrder(order.token, { note: 'x' })).toMatchObject({
      ok: false,
      error: 'changes_closed',
    });
    expect(await onde.cancelOrder(order.token)).toMatchObject({
      ok: false,
      error: 'changes_closed',
    });
  });
});
