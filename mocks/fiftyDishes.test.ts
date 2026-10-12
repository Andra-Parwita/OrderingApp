/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 066, stage 1: a 50-dish menu and 50-line orders stay inside the free plan's D1 budget
// (about 50 queries per request; held to 40 round trips here, a batch counting as one, with the
// statement count written to scratch/066-calls.txt too). Runs against a local D1; see mocks/impl.ts.
import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { MAX_MENU_ITEMS } from '../shared/limits';
import { devApi, useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const LIMIT = 40;

describe('a 50-dish menu and 50-line orders', () => {
  const create = useWorld('fifty');
  let world: World;
  const results: Array<string> = [];
  const dishIds: Array<string> = [];
  let itemIds: Array<string> = [];
  let token = '';
  let code = '';

  async function call(method: string, path: string, body?: unknown) {
    world.queries.reset();
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers: {
          'X-Seller': 'onde-onde',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const trips = world.queries.count();
    const statements = world.queries.statements();
    results.push(`${method} ${path}: ${String(trips)} trips, ${String(statements)} statements`);
    return { status: response?.status ?? -1, json: await response?.json(), trips };
  }

  beforeAll(async () => {
    let n = 0;
    world = await create({
      now: () => NOW,
      newToken: () => `tok-${String(++n)}-${'x'.repeat(20)}`,
    });
    await call('POST', '/api/seller/menus/current/unpublish');
  }, 120_000);

  it('keeps the limit at 50', () => {
    expect(MAX_MENU_ITEMS).toBe(50);
  });

  it('puts 50 dishes on the menu in few round trips', async () => {
    for (let i = 0; i < MAX_MENU_ITEMS; i++) {
      const made = await call('POST', '/api/seller/dishes', {
        name: { en: `Dish ${i}`, id: `Hidangan ${i}` },
        priceCents: 500,
      });
      expect(made.status).toBe(201);
      dishIds.push(made.json.dish.id);
    }
    const put = await call('PUT', '/api/seller/menus/current', { dishIds });
    expect(put.status).toBe(200);
    expect(put.json.menu.dishes).toHaveLength(50);
    expect(put.trips).toBeLessThan(LIMIT);
    itemIds = put.json.menu.dishes.map((d: { id: string }) => d.id);
  }, 120_000);

  it('refuses a 51st dish', async () => {
    const made = await call('POST', '/api/seller/dishes', {
      name: { en: 'One more', id: 'Satu lagi' },
      priceCents: 500,
    });
    const add = await call('POST', '/api/seller/menus/current/items', {
      dishId: made.json.dish.id,
    });
    expect(add.status).toBe(409);
  });

  it('publishes it', async () => {
    const published = await call('POST', '/api/seller/menus/current/publish');
    expect(published.status).toBe(200);
    expect(published.json.menu.menu.state).toBe('live');
    expect(published.trips).toBeLessThan(LIMIT);
    const view = await call('GET', '/api/s/onde-onde/menu');
    expect(view.status).toBe(200);
    expect(view.trips).toBeLessThan(LIMIT);
  });

  it('places, edits and reads a 50-line customer order', async () => {
    const placed = await call('POST', '/api/s/onde-onde/orders', {
      firstName: 'Nia',
      language: 'en',
      fulfilment: 'pickup',
      lines: itemIds.map((itemId) => ({ itemId, qty: 2 })),
    });
    expect(placed.status).toBe(201);
    expect(placed.trips).toBeLessThan(LIMIT);
    token = placed.json.order.token;
    code = placed.json.order.code;
    const edited = await call('PATCH', `/api/orders/${token}`, {
      lines: itemIds.map((itemId) => ({ itemId, qty: 3 })),
    });
    expect(edited.status).toBe(200);
    expect(edited.trips).toBeLessThan(LIMIT);
    const fetched = await call('GET', `/api/orders/${token}`);
    expect(fetched.json.order.lines).toHaveLength(50);
    expect(fetched.trips).toBeLessThan(LIMIT);
  });

  it('places a 50-line seller order and changes its status', async () => {
    const placed = await call('POST', '/api/seller/orders', {
      firstName: 'Walk-in',
      language: 'en',
      fulfilment: 'pickup',
      lines: itemIds.map((itemId) => ({ itemId, qty: 1 })),
    });
    expect(placed.status).toBe(201);
    expect(placed.trips).toBeLessThan(LIMIT);
    const status = await call('POST', `/api/seller/orders/${code}/status`, { to: 'confirmed' });
    expect(status.status).toBe(200);
    expect(status.trips).toBeLessThan(LIMIT);
    const list = await call('GET', '/api/seller/orders');
    expect(list.trips).toBeLessThan(LIMIT);
  });

  it('finishes the menu with 50-line orders', async () => {
    const done = await call('POST', '/api/seller/menus/current/finish');
    expect(done.status).toBe(200);
    expect(done.trips).toBeLessThan(LIMIT);
  });

  it('writes the table', () => {
    writeFileSync('scratch/066-calls.txt', `${results.join('\n')}\n`);
  });
});
