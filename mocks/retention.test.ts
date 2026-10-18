// @vitest-environment node
// Stage 8.4b: the weekly retention cron (worker/api/scheduled.ts), on a scratch local D1.
import { beforeEach, describe, expect, it } from 'vitest';
import { runRetention } from '../worker/api/scheduled';
import { useWorld, type World } from './impl';

const PLACED = new Date('2026-10-07T10:00:00Z');
// Cooking date 2026-10-10 + 4 weeks = 2026-11-07; the cron runs on the Monday after.
const MONDAY_AFTER = new Date('2026-11-09T03:00:00Z');
const MONDAY_BEFORE = new Date('2026-11-02T03:00:00Z');

describe('weekly retention cron', () => {
  const create = useWorld('retention');
  let world: World;
  let now = PLACED;
  let n = 0;

  async function closedWeekWith(slug: string, names: Array<string>) {
    const seller = await world.repo.sellerBySlug(slug);
    if (!seller) throw new Error('no seller');
    const item = (await seller.getMenu()).items[0];
    for (const firstName of names) {
      const placed = await seller.createOrder({
        firstName,
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: item?.id ?? '', qty: 1 }],
      });
      if (!placed.ok) throw new Error(placed.message);
    }
    await seller.publishMenu();
    await seller.finishMenuNow();
  }

  const count = async (table: string) =>
    (await world.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n;

  beforeEach(async () => {
    now = PLACED;
    n = 0;
    world = await create({
      now: () => now,
      newToken: () => `token-${String(++n)}-padding-padding`,
    });
    // Both sample kitchens publish a menu for 2026-10-10, so both can have a closed week.
    await world.db.stmt("UPDATE menus SET state = 'live'").run();
  });

  it('drops the details of every seller past the keep date and keeps the totals', async () => {
    await closedWeekWith('onde-onde', ['Rina', 'Tom', 'Sari']);
    await closedWeekWith('dapur-demo', ['Budi']);
    const lines: Array<string> = [];

    const counts = await runRetention({ DB: world.db.d1 }, MONDAY_AFTER, (l) => lines.push(l));

    expect(counts).toEqual({ weeks: 2, orders: 4 });
    expect(await count('orders')).toBe(0);
    expect(await count('expired_orders')).toBe(4);
    expect(await count('past_weeks')).toBe(2);
    expect(
      await world.db.first('SELECT COUNT(*) AS n FROM past_weeks WHERE details_dropped_at IS NULL'),
    ).toEqual({ n: 0 });
    // Counts only: not a name, a token or a code.
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('retention: 2 week(s) archived, 4 order(s) dropped');
  });

  it('is idempotent: a second run finds nothing', async () => {
    await closedWeekWith('onde-onde', ['Rina', 'Tom']);
    await runRetention({ DB: world.db.d1 }, MONDAY_AFTER, () => undefined);
    const again = await runRetention({ DB: world.db.d1 }, MONDAY_AFTER, () => undefined);
    expect(again).toEqual({ weeks: 0, orders: 0 });
    expect(await count('expired_orders')).toBe(2);
  });

  it('leaves a week alone until its keep date has passed', async () => {
    await closedWeekWith('onde-onde', ['Rina']);
    const early = await runRetention({ DB: world.db.d1 }, MONDAY_BEFORE, () => undefined);
    expect(early).toEqual({ weeks: 0, orders: 0 });
    expect(await count('orders')).toBe(1);
  });

  it('deletes the push subscriptions of the orders it drops', async () => {
    await closedWeekWith('onde-onde', ['Rina']);
    // Finishing the menu already cleared the week's subscriptions; one is put back so retention's
    // own cleanup is what is proved.
    const order = await world.db.first<{ seller_id: string; id: string }>(
      'SELECT seller_id, id FROM orders',
    );
    await world.db
      .stmt(
        "INSERT INTO push_subscriptions (seller_id, order_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, 'https://push.example/x', 'k', 'a', ?)",
        order?.seller_id,
        order?.id,
        PLACED.toISOString(),
      )
      .run();
    expect(await count('push_subscriptions')).toBe(1);
    await runRetention({ DB: world.db.d1 }, MONDAY_AFTER, () => undefined);
    expect(await count('orders')).toBe(0);
    expect(await count('push_subscriptions')).toBe(0);
  });

  it('does not touch the live week', async () => {
    await closedWeekWith('onde-onde', ['Rina']);
    const seller = await world.repo.sellerBySlug('onde-onde');
    await world.db.stmt("UPDATE menus SET state = 'live'").run();
    await seller?.createOrder({
      firstName: 'Live',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: (await seller.getMenu()).items[0]?.id ?? '', qty: 1 }],
    });
    await runRetention({ DB: world.db.d1 }, MONDAY_AFTER, () => undefined);
    expect(await count('orders')).toBe(1);
  });

  it('C10: sweeps keys and codes expired for over 7 days, keeps live and recent ones', async () => {
    const seller = await world.db.first<{ id: string }>('SELECT id FROM sellers LIMIT 1');
    const sid = seller?.id ?? '';
    const aid = 'person:sweep';
    await world.db
      .stmt(
        "INSERT INTO accounts (id, role, display_name, created_at) VALUES (?, 'person', 'Sweep', ?)",
        aid,
        PLACED.toISOString(),
      )
      .run();
    const day = (n: number) => new Date(MONDAY_AFTER.getTime() + n * 86_400_000).toISOString();
    for (const [hash, at] of [
      ['k-old', day(-8)],
      ['k-recent', day(-3)],
      ['k-live', day(2)],
    ] as const) {
      await world.db
        .stmt(
          "INSERT INTO auth_keys (key_hash, seller_id, role, chef_id, display_name, created_at, expires_at) VALUES (?, ?, 'owner', NULL, 'N', ?, ?)",
          hash,
          sid,
          day(-20),
          at,
        )
        .run();
    }
    await world.db
      .stmt(
        "INSERT INTO auth_key_redemptions (key_hash, client_device_id, redeemed_at) VALUES ('k-old', 'd', ?)",
        day(-9),
      )
      .run();
    for (const [hash, at] of [
      ['c-old', day(-8)],
      ['c-live', day(0.01)],
    ] as const) {
      await world.db
        .stmt(
          'INSERT INTO auth_codes (code_hash, account_id, seller_id, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)',
          hash,
          aid,
          sid,
          day(-20),
          at,
        )
        .run();
    }
    const lines: Array<string> = [];
    await runRetention({ DB: world.db.d1 }, MONDAY_AFTER, (l) => lines.push(l));
    const keys = await world.db.all<{ key_hash: string }>(
      'SELECT key_hash FROM auth_keys ORDER BY 1',
    );
    const codes = await world.db.all<{ code_hash: string }>(
      'SELECT code_hash FROM auth_codes ORDER BY 1',
    );
    expect(keys.map((k) => k.key_hash)).toEqual(['k-live', 'k-recent']);
    expect(codes.map((c) => c.code_hash)).toEqual(['c-live']);
    expect(await count('auth_key_redemptions')).toBe(0);
    expect(lines).toContain('retention: 1 expired key(s), 1 expired code(s) dropped');
  });
});
