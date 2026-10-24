// @vitest-environment node
// Plan 113 (1.0.44): fewer database round trips per request. Budgets for the busiest routes, in
// round trips (a batch is one) and statements (each one in a batch counted). The cap is the plan's
// target. Before the change (trips / statements, 30 sample orders): PATCH order 7 / 27, cancel 6 / 24,
// private create 7 / 11, dish edit 5 / 5, backup 15 / 37.
// Runs against a local D1; see mocks/impl.ts.
import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { devApi, useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');

describe('round trips per route (plan 113)', () => {
  const create = useWorld('round-trips');
  let world: World;
  let tokens: Array<string> = [];

  async function api(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { 'X-Seller': 'onde-onde' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    world.queries.reset();
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const counts = { trips: world.queries.count(), statements: world.queries.statements() };
    return { status: response?.status, json: (await response?.json()) as unknown, ...counts };
  }
  const seen = new Set<string>();
  const note = (name: string, c: { trips: number; statements: number }) => {
    const line = `${name}: ${String(c.trips)} trips, ${String(c.statements)} statements`;
    seen.add(line);
    return line;
  };
  afterAll(() => {
    // A file, not the console: the test setup keeps the console quiet.
    writeFileSync(
      process.env['QUERY_TABLE'] ?? 'scratch/113-round-trips.txt',
      `${[...seen].join('\n')}\n`,
    );
  });

  beforeAll(async () => {
    world = await create({ now: () => NOW });
    await world.db.stmt('UPDATE menu_items SET portion_limit = NULL').run();
    await world.repo.dev.addSampleOrders('seller-onde-onde', 30);
    const listed = await api('GET', '/api/seller/orders');
    tokens = (
      listed.json as { orders: Array<{ token: string; status: string; locked: boolean }> }
    ).orders
      .filter((o) => o.status === 'ordered' && !o.locked)
      .map((o) => o.token);
    expect(tokens.length).toBeGreaterThan(3);
  }, 120_000);

  it('PATCH /api/orders/:token: at most 4 trips', async () => {
    const r = await api('PATCH', `/api/orders/${tokens[0]}`, { note: 'No chilli' });
    expect(r.status).toBe(200);
    expect(r.trips, note('PATCH order', r)).toBeLessThanOrEqual(4);
    expect(r.statements, note('PATCH order', r)).toBeLessThanOrEqual(19);
  });

  it('POST /api/orders/:token/cancel: at most 5 trips', async () => {
    const r = await api('POST', `/api/orders/${tokens[1]}/cancel`);
    expect(r.status).toBe(200);
    expect(r.trips, note('cancel', r)).toBeLessThanOrEqual(5);
    expect(r.statements, note('cancel', r)).toBeLessThanOrEqual(20);
  });

  it('private order build with a choice and a plain dish: the dish reads take one trip', async () => {
    const made = await api('POST', '/api/seller/dishes', {
      name: { en: 'Cakes', id: 'Kue' },
      priceCents: 600,
      size: { en: 'pack', id: 'bungkus' },
      choices: [
        { name: { en: 'Pandan', id: '' }, limit: null },
        { name: { en: 'Choc', id: '' }, limit: null },
      ],
    });
    const dish = (made.json as { dish: { id: string; choices: Array<{ id: string }> } }).dish;
    const plain = (
      (await api('GET', '/api/seller/dishes')).json as {
        dishes: Array<{ id: string; choices?: unknown }>;
      }
    ).dishes.find((d) => d.choices === undefined)?.id;
    const r = await api('POST', '/api/seller/private', {
      firstName: 'Bu Ani',
      language: 'en',
      eventDate: '2026-10-17',
      lines: [
        { dishId: dish.choices[0]?.id, qty: 2 },
        { dishId: plain, qty: 1 },
      ],
    });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    // Before: 7 (the build alone was 3: dishes, parents, choices).
    expect(r.trips, note('private create', r)).toBeLessThanOrEqual(5);
  });

  it('PATCH /api/seller/dishes/:id (no choices change): the dish and its choices in one batch', async () => {
    const dishes = (await api('GET', '/api/seller/dishes')).json as {
      dishes: Array<{ id: string }>;
    };
    const id = dishes.dishes[0]?.id;
    const r = await api('PATCH', `/api/seller/dishes/${id}`, { priceCents: 777 });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    // Before: 5.
    expect(r.trips, note('dish edit', r)).toBeLessThanOrEqual(4);
  });

  it('GET /api/seller/backup: at most 8 trips and 25 statements', async () => {
    const r = await api('GET', '/api/seller/backup');
    expect(r.status).toBe(200);
    expect(r.trips, note('backup', r)).toBeLessThanOrEqual(8);
    expect(r.statements, note('backup', r)).toBeLessThanOrEqual(25);
  });
});
