/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 113 item 7: the backup is built from a few batched reads instead of twelve service calls. The
// file must not change by a byte. This builds a kitchen with everything a backup covers (dishes
// with choices, saved sets, pickup places with their own times, three closed weeks of which the
// oldest is past its keep date, a live menu with cancelled, edited and choice orders, private orders
// that a backup leaves out, a send log) and compares the shipped export with the old one
// (mocks/legacyBackup.ts), as objects and as JSON text. Then it restores the file into a fresh
// kitchen and backs that up again: the round trip must give the same file.
// Runs against a local D1; see mocks/impl.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import { Db } from '../worker/db/d1';
import { createSellerContext } from '../worker/db/sellerContext';
import { legacyExportBackup } from './legacyBackup';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';

describe('backup: new export equals the old one (plan 113)', () => {
  const create = useWorld('backup-compare');
  let clock = Date.parse('2026-08-05T10:00:00Z');
  let world: World;

  async function api(method: string, path: string, body?: unknown): Promise<any> {
    const headers: Record<string, string> = { 'X-Seller': 'onde-onde' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const text = (await response?.text()) ?? '';
    if (!response?.ok) throw new Error(`${method} ${path} -> ${String(response?.status)} ${text}`);
    return JSON.parse(text);
  }
  const ordersOf = async (): Promise<Array<any>> => (await api('GET', '/api/seller/orders')).orders;

  /** A week: publish, take orders (sample, edited, cancelled, with a note), then finish. */
  async function runWeek(cookingDate: string, finish: boolean, seeded = false): Promise<void> {
    if (!seeded) {
      await api('POST', '/api/seller/menus', { cookingDate });
      const dishes: Array<any> = (await api('GET', '/api/seller/dishes')).dishes;
      for (const dish of dishes.slice(0, 4)) {
        await api('POST', '/api/seller/menus/current/items', { dishId: dish.id });
      }
      await api('POST', '/api/seller/menus/current/publish', {});
    }
    await world.db
      .stmt('UPDATE menu_items SET portion_limit = NULL WHERE seller_id = ?', SELLER_ID)
      .run();
    await world.repo.dev.addSampleOrders(SELLER_ID, 40);
    // Plan 121 B: two customer orders that carry the anonymous facts (all four, then only one).
    const menuItems: Array<any> = (await api('GET', '/api/seller/menu')).items;
    const plain = menuItems.find((i) => i.groupId === undefined && i.preorder !== false);
    const customer = (firstName: string, stats: unknown) =>
      api('POST', '/api/s/onde-onde/orders', {
        firstName,
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: plain.id, qty: 1 }],
        stats,
      });
    await customer(`Stats ${cookingDate}`, {
      place: 'app',
      os: 'ios',
      push: true,
      remember: false,
    });
    await customer(`Part ${cookingDate}`, { place: 'inapp' });
    const orders = await ordersOf();
    const open = orders.filter((o) => o.status === 'ordered' && !o.locked);
    // Whatever the sample generator left open gets one change each.
    const todo: Array<() => Promise<unknown>> = [
      () => api('PATCH', `/api/orders/${open[0]?.token}`, { note: `Less sweet ${cookingDate}` }),
      () => api('POST', `/api/orders/${open[1]?.token}/cancel`),
      () => api('POST', `/api/seller/orders/${open[2]?.code}/status`, { to: 'confirmed' }),
      () => api('POST', `/api/seller/orders/${open[3]?.code}/paid`, { paid: true }),
      () => api('POST', `/api/seller/orders/${open[4]?.code}/lock`, { locked: true }),
      () => api('POST', `/api/seller/orders/${open[5]?.code}/wa-received`, { received: true }),
    ];
    for (const [index, change] of todo.entries()) if (open[index]) await change();
    if (finish) await api('POST', '/api/seller/menus/current/finish');
  }

  beforeAll(async () => {
    world = await create({ now: () => new Date(clock) });

    // The library: dishes with choices, one sold on the day only, used and unused (last_used_at).
    await api('POST', '/api/seller/dishes', {
      name: { en: 'Cakes', id: 'Kue' },
      priceCents: 600,
      size: { en: 'pack', id: 'bungkus' },
      choices: [
        { name: { en: 'Pandan', id: 'Pandan' }, limit: 3 },
        { name: { en: 'choc', id: '' }, limit: null },
      ],
    });
    await api('POST', '/api/seller/dishes', {
      name: { en: 'apple pie', id: 'pai apel' },
      priceCents: 900,
      size: { en: 'slice', id: 'potong' },
      preorder: false,
      dayStock: 5,
    });
    await api('POST', '/api/seller/dishes', {
      name: { en: 'Banana bread', id: 'Roti pisang' },
      description: { en: 'Moist', id: 'Lembap' },
      priceCents: 750,
      size: { en: 'loaf', id: 'loyang' },
    });
    const library: Array<any> = (await api('GET', '/api/seller/dishes')).dishes;
    await api('POST', '/api/seller/saved-sets', {
      name: 'Weekend',
      dishIds: library.slice(0, 2).map((d) => d.id),
    });

    // Pickup places with their own times on the menu.
    await api('POST', '/api/seller/pickup-places', {
      place: 'Oxford Tce',
      directions: { en: 'Blue door', id: 'Pintu biru' },
      window: { start: '10:00', end: '12:00' },
    });

    // Week 1 (closed; past its keep date by October), week 2 and week 3 (closed, details kept).
    await runWeek('2026-08-08', true, true);
    clock = Date.parse('2026-09-09T10:00:00Z');
    await runWeek('2026-09-12', true);
    clock = Date.parse('2026-09-30T10:00:00Z');
    await runWeek('2026-10-03', true);

    // The live menu: places with their own time, choice orders, a send log, private orders.
    clock = Date.parse('2026-10-07T10:00:00Z');
    await runWeek('2026-10-10', false);
    const places: Array<any> = (await api('GET', '/api/seller/pickup-places')).places;
    await api('PUT', '/api/seller/menus/current', {
      places: places.map((p, i) =>
        i === 0 ? { placeId: p.id } : { placeId: p.id, window: { start: '14:00', end: '15:30' } },
      ),
    });
    const library2: Array<any> = (await api('GET', '/api/seller/dishes')).dishes;
    const cakes = library2.find((d) => d.choices !== undefined);
    // Already on the menu if the week picked it up; either way the menu has its choices.
    await api('POST', '/api/seller/menus/current/items', { dishId: cakes.id }).catch(
      () => undefined,
    );
    const live: Array<any> = (await api('GET', '/api/seller/menu')).items;
    const choiceItem = live.find((i) => i.groupId !== undefined);
    await api('POST', '/api/seller/orders', {
      firstName: 'Walk-in',
      language: 'id',
      fulfilment: 'pickup',
      lines: [{ itemId: choiceItem.id, qty: 2, note: 'No nuts' }],
    });
    await api('POST', `/api/seller/messages/place/${places[0].id}`, { type: 'ready_now' });
    clock += 60_000; // a restore keeps the log's order only when its entries differ in time
    await api('POST', `/api/seller/messages/place/${places[0].id}`, {
      type: 'custom',
      text: { en: 'On our way', id: 'Dalam perjalanan' },
      force: true,
    });
    await api('POST', '/api/seller/private', {
      firstName: 'Zorro Privat',
      language: 'en',
      eventDate: '2026-10-17',
      lines: [{ dishId: cakes.choices[0].id, qty: 3 }],
    });
  }, 300_000);

  /** The shipped export and the old one, each as a plain object. */
  async function both() {
    const store = await world.repo.sellerBySlug('onde-onde');
    const seller = store!.seller;
    const context = createSellerContext(
      {
        db: new Db(world.db.d1),
        now: () => new Date(clock),
        newId: () => 'unused',
        newCode: () => 'unused',
        newToken: () => 'unused',
        seed: 1,
        samples: new Map(),
      },
      seller,
    );
    const old = await legacyExportBackup(context);
    const next = await store!.exportBackup();
    return { old, next };
  }

  it('the fixture holds everything a backup covers', async () => {
    const { next } = await both();
    expect(next.pastWeeks).toHaveLength(3);
    // Newest first: the oldest week is past its keep date, so its orders are gone.
    expect(next.pastWeeks.map((w) => w.orders !== undefined)).toEqual([true, true, false]);
    expect(next.orders.length).toBeGreaterThan(12);
    expect(next.orders.some((o) => o.status === 'cancelled')).toBe(true);
    expect(next.orders.some((o) => o.lines.some((l) => l.note !== undefined))).toBe(true);
    // Plan 121 B: the anonymous facts ride along, in the live menu and in a closed week.
    expect(next.orders.some((o) => o.stats?.push === true && o.stats.place === 'app')).toBe(true);
    expect(next.orders.some((o) => o.stats?.place === 'inapp' && o.stats.os === undefined)).toBe(
      true,
    );
    expect(next.pastWeeks.some((w) => w.orders?.some((o) => o.stats !== undefined))).toBe(true);
    expect(next.dishes?.some((d) => (d.choices ?? []).length === 2)).toBe(true);
    expect(next.items.some((i) => i.groupId !== undefined)).toBe(true);
    expect(next.sets.length).toBeGreaterThan(1);
    expect(next.pickupPlaces?.length).toBeGreaterThan(1);
    expect(next.menu?.placeUses.some((u) => u.window !== undefined)).toBe(true);
    expect(next.messageLog?.length).toBeGreaterThan(0);
    expect(Object.keys(next.itemDishIds ?? {}).length).toBeGreaterThan(3);
    // Private orders are not in a backup.
    expect(JSON.stringify(next)).not.toContain('Zorro Privat');
    const privates = await world.db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE kind = 'private'",
    );
    expect(privates?.n).toBe(1);
  });

  it('gives the same file as the old export: equal as objects and as JSON text', async () => {
    const { old, next } = await both();
    expect(next).toEqual(old);
    // Same key order too, so the downloaded file is the same text.
    expect(JSON.stringify(next)).toBe(JSON.stringify(old));
  });

  it('restoring it into a fresh kitchen and backing up again gives the same file (round trip)', async () => {
    const { next } = await both();
    const parsed = parseBackupFile(JSON.parse(JSON.stringify(next)));
    expect(parsed).not.toBeNull();
    // `create` resets the shared scratch database to the sample kitchens: a fresh one.
    const fresh = await create({ now: () => new Date(clock) });
    const target = await fresh.repo.sellerBySlug('onde-onde');
    expect(await target!.restoreBackup(parsed!)).toBe(0);
    const again = await target!.exportBackup();
    expect(again).toEqual(next);
    expect(JSON.stringify(again)).toBe(JSON.stringify(next));
  });
});
