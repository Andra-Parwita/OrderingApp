// @vitest-environment node
// Plan 130: the hourly job cancels customer orders still Ordered 24 hours after they were placed.
// Runs against a local D1 with an injected clock; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_CANCEL_SINCE,
  autoCancelAt,
  autoCancelEntry,
  isAutoCancelSoon,
} from '../shared/autoCancel';
import type { StaffActor } from '../shared/domain';
import { useWorld, type World } from './impl';

const START = new Date('2026-10-07T10:00:00Z');
const HOUR = 3_600_000;
// Orders are placed on the mock clock, then dated after the rule's start (plan 130).
const CREATED = new Date('2026-11-12T08:00:00Z');
const staff: StaffActor = { role: 'seller', name: 'Rina' };

describe('auto-cancel of unconfirmed customer orders (plan 130)', () => {
  const create = useWorld('auto-cancel');
  let world: World;
  let clock = START;
  let n = 0;

  const seller = async () => {
    const handle = await world.repo.sellerBySlug('onde-onde');
    if (!handle) throw new Error('no seller');
    return handle;
  };
  const request = (firstName: string) => ({
    firstName,
    language: 'en' as const,
    fulfilment: 'pickup' as const,
    lines: [{ itemId: 'pesmol', qty: 1 }],
  });
  const place = async (name = 'Rina') => {
    const made = await (await seller()).createOrder(request(name));
    if (!made.ok) throw new Error(made.error);
    await world.db
      .stmt(
        'UPDATE orders SET created_at = ? WHERE code = ?',
        CREATED.toISOString(),
        made.value.code,
      )
      .run();
    return made.value;
  };
  const after = (hours: number) => {
    clock = new Date(CREATED.getTime() + hours * HOUR);
  };
  const statusOf = async (code: string) => (await (await seller()).getByCode(code))?.status;

  beforeEach(async () => {
    n = 0;
    clock = START;
    world = await create({
      now: () => clock,
      newToken: () => `token-${String(++n)}-padding-padding`,
    });
  });

  it('does nothing at 23 h 59 and cancels at 24 h, by the app, with the reason', async () => {
    const order = await place();
    after(23.98);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(0);
    expect(await statusOf(order.code)).toBe('ordered');
    after(24);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(1);
    const done = await (await seller()).getByCode(order.code);
    expect(done?.status).toBe('cancelled');
    expect(done && autoCancelEntry(done)?.by).toEqual({ role: 'seller', name: 'App' });
    expect(done?.inbox.some((entry) => entry.textKey === 'autoCancelled')).toBe(true);
    // Idempotent: the next hour finds nothing.
    expect(await world.repo.autoCancelUnconfirmed()).toBe(0);
  });

  it('skips seller-entered, confirmed, WhatsApp-received and private orders', async () => {
    const onde = await seller();
    const entered = await onde.createSellerOrder(
      { ...request('Entered'), confirmNow: false },
      staff,
    );
    const confirmed = await place('Confirmed');
    const received = await place('Received');
    const priv = await place('Private');
    const target = await place('Target');
    if (!entered.ok) throw new Error(entered.error);
    await onde.setStatus(confirmed.code, 'confirmed', staff);
    await onde.setWaReceived(received.code, true);
    await world.db.stmt("UPDATE orders SET kind = 'private' WHERE code = ?", priv.code).run();
    after(25);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(1);
    expect(await statusOf(target.code)).toBe('cancelled');
    for (const order of [entered.value, confirmed, received, priv]) {
      expect(await statusOf(order.code)).not.toBe('cancelled');
    }
  });

  it('restores an order, and never cancels a restored order again', async () => {
    const onde = await seller();
    const order = await place();
    after(25);
    await world.repo.autoCancelUnconfirmed();
    const restored = await onde.restoreOrder(order.code, staff);
    expect(restored).toMatchObject({ ok: true });
    expect(await statusOf(order.code)).toBe('ordered');
    after(80);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(0);
    expect(await statusOf(order.code)).toBe('ordered');
    // Only a cancelled order can be restored.
    expect(await onde.restoreOrder(order.code, staff)).toMatchObject({ ok: false });
  });

  it('counts from the rule start for an older order, and from created_at for a newer one', async () => {
    const order = await place();
    // Placed before the rule's start: nothing is due until the start + 24 h.
    await world.db
      .stmt('UPDATE orders SET created_at = ? WHERE code = ?', START.toISOString(), order.code)
      .run();
    const since = Date.parse(AUTO_CANCEL_SINCE);
    clock = new Date(since + 23.9 * HOUR);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(0);
    clock = new Date(since + 24 * HOUR);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(1);
    expect(await statusOf(order.code)).toBe('cancelled');
    // After the start the order's own time counts (the other tests: created + 24 h).
    expect(autoCancelAt(CREATED.toISOString())).toBe(
      new Date(CREATED.getTime() + 24 * HOUR).toISOString(),
    );
    expect(autoCancelAt(START.toISOString())).toBe(new Date(since + 24 * HOUR).toISOString());
  });

  it('keeps a restored order out of the auto-cancel even after five later changes', async () => {
    const onde = await seller();
    const order = await place();
    after(25);
    await world.repo.autoCancelUnconfirmed();
    await onde.restoreOrder(order.code, staff);
    expect((await onde.getByCode(order.code))?.waReceived).toBe(true);
    // Five more changes push the `restored` entry out of the 4-entry history.
    for (let i = 0; i < 5; i += 1) await onde.setPaid(order.code, i % 2 === 0, staff);
    expect((await onde.getByCode(order.code))?.audit.some((a) => a.detail === 'restored')).toBe(
      false,
    );
    after(100);
    expect(await world.repo.autoCancelUnconfirmed()).toBe(0);
    expect(await statusOf(order.code)).toBe('ordered');
  });

  it('shows the warning only in the last 2 hours', async () => {
    const order = await place();
    const full = await (await seller()).getByCode(order.code);
    if (!full) throw new Error('no order');
    const at = Date.parse(autoCancelAt(full.createdAt));
    expect(isAutoCancelSoon(full, at - 2.01 * HOUR)).toBe(false);
    expect(isAutoCancelSoon(full, at - 1.99 * HOUR)).toBe(true);
    expect(isAutoCancelSoon(full, at)).toBe(false);
    expect(isAutoCancelSoon({ ...full, waReceived: true }, at - HOUR)).toBe(false);
  });
});
