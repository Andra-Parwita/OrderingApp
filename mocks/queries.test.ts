// @vitest-environment node
// Stage 8.4b: the free Workers plan allows 50 D1 queries per invocation. With 100 orders in the week,
// every route must stay under 40 (a margin for the session lookup that a signed-in call adds on top:
// at most 4). Counts are round trips (a batch is one); statements are held to the same limit except
// for the two bulk routes.
// Runs against a local D1; see mocks/impl.ts.
import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseSellerOrdersResponse } from '../shared/orderContract';
import { devApi, useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const SELLER_ID = 'seller-onde-onde';
const LIMIT = 40;

type Ctx = {
  codes: Array<string>;
  tokens: Array<string>;
  /** Orders nobody has touched: status ordered, not locked. */
  fresh: Array<{ code: string; token: string }>;
  backup: unknown;
  weekId: string;
};
type Route = {
  name: string;
  method: string;
  path: (ctx: Ctx) => string;
  body?: (ctx: Ctx) => unknown;
  status?: number;
  /** Writes a row per order by design: one batch, so only round trips are held to the limit. */
  bulk?: true;
};

const ROUTES: Array<Route> = [
  { name: 'GET /api/s/:slug/menu', method: 'GET', path: () => '/api/s/onde-onde/menu' },
  {
    name: 'POST /api/s/:slug/orders',
    method: 'POST',
    path: () => '/api/s/onde-onde/orders',
    body: () => ({
      firstName: 'Nia',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'tempe-mendoan', qty: 2 }],
    }),
    status: 201,
  },
  {
    name: 'GET /api/orders?tokens= (20)',
    method: 'GET',
    path: (c) => `/api/orders?tokens=${c.tokens.slice(0, 20).join(',')}`,
  },
  { name: 'GET /api/orders/:token', method: 'GET', path: (c) => `/api/orders/${c.tokens[0]}` },
  {
    name: 'PATCH /api/orders/:token',
    method: 'PATCH',
    path: (c) => `/api/orders/${c.fresh[1]?.token}`,
    body: () => ({ note: 'No chilli' }),
  },
  {
    name: 'POST /api/orders/:token/cancel',
    method: 'POST',
    path: (c) => `/api/orders/${c.fresh[2]?.token}/cancel`,
  },
  { name: 'GET seller/menu', method: 'GET', path: () => '/api/seller/menu' },
  { name: 'GET seller/settings', method: 'GET', path: () => '/api/seller/settings' },
  { name: 'GET seller/week', method: 'GET', path: () => '/api/seller/week' },
  { name: 'GET seller/chefs', method: 'GET', path: () => '/api/seller/chefs' },
  { name: 'GET seller/sets', method: 'GET', path: () => '/api/seller/sets' },
  { name: 'GET seller/images', method: 'GET', path: () => '/api/seller/images' },
  { name: 'GET seller/chef-devices', method: 'GET', path: () => '/api/seller/chef-devices' },
  { name: 'GET seller/past-weeks', method: 'GET', path: () => '/api/seller/past-weeks' },
  { name: 'GET seller/orders', method: 'GET', path: () => '/api/seller/orders' },
  { name: 'GET seller/orders.csv', method: 'GET', path: () => '/api/seller/orders.csv' },
  { name: 'GET seller/backup', method: 'GET', path: () => '/api/seller/backup' },
  {
    name: 'GET seller/orders/:code',
    method: 'GET',
    path: (c) => `/api/seller/orders/${c.codes[3]}`,
  },
  {
    name: 'POST seller/orders',
    method: 'POST',
    path: () => '/api/seller/orders',
    body: () => ({
      firstName: 'Walk-in',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
    }),
    status: 201,
  },
  {
    name: 'POST seller/orders/:code/status',
    method: 'POST',
    path: (c) => `/api/seller/orders/${c.fresh[3]?.code}/status`,
    body: () => ({ to: 'confirmed' }),
  },
  {
    name: 'POST seller/orders/:code/paid',
    method: 'POST',
    path: (c) => `/api/seller/orders/${c.fresh[4]?.code}/paid`,
    body: () => ({ paid: true }),
  },
  {
    name: 'POST seller/orders/:code/lock',
    method: 'POST',
    path: (c) => `/api/seller/orders/${c.fresh[4]?.code}/lock`,
    body: () => ({ locked: true }),
  },
  {
    name: 'POST seller/orders/:code/wa-received',
    method: 'POST',
    path: (c) => `/api/seller/orders/${c.fresh[4]?.code}/wa-received`,
    body: () => ({ received: true }),
  },
  {
    name: 'POST seller/updates (100 codes)',
    method: 'POST',
    path: () => '/api/seller/updates',
    body: (c) => ({ template: 'ready', codes: c.codes.slice(0, 100) }),
    bulk: true,
  },
  {
    name: 'POST seller/backup (restore)',
    method: 'POST',
    path: () => '/api/seller/backup',
    body: (c) => c.backup,
    bulk: true,
  },
  { name: 'POST seller/week/close', method: 'POST', path: () => '/api/seller/week/close' },
  {
    name: 'GET seller/past-weeks/:id',
    method: 'GET',
    path: (c) => `/api/seller/past-weeks/${c.weekId}`,
  },
];

describe('D1 queries per route, 100 orders in the week', () => {
  const create = useWorld('queries');
  let world: World;
  const ctx: Ctx = { codes: [], tokens: [], fresh: [], backup: null, weekId: '' };
  const results = new Map<string, { trips: number; statements: number }>();

  async function call(route: Route) {
    const headers: Record<string, string> = { 'X-Seller': 'onde-onde' };
    const body = route.body?.(ctx);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    world.queries.reset();
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${route.path(ctx)}`, {
        method: route.method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    return { response, trips: world.queries.count(), statements: world.queries.statements() };
  }

  beforeAll(async () => {
    let n = 0;
    world = await create({
      now: () => NOW,
      newToken: () => `tok-${String(++n)}-${'x'.repeat(20)}`,
    });
    // No portion limits, so 100 sample orders all fit.
    await world.db.stmt('UPDATE menu_items SET portion_limit = NULL').run();
    expect(await world.repo.dev.addSampleOrders(SELLER_ID, 100)).toBe(100);
    const listed = await devApi(
      world.repo,
      new Request('https://delave.test/api/seller/orders', {
        headers: { 'X-Seller': 'onde-onde' },
      }),
    );
    const orders = parseSellerOrdersResponse(await listed?.json())?.orders ?? [];
    ctx.codes = orders.map((order) => order.code);
    ctx.tokens = orders.map((order) => order.token);
    expect(ctx.codes).toHaveLength(100);
    ctx.fresh = orders.filter((o) => o.status === 'ordered' && !o.locked);
    expect(ctx.fresh.length).toBeGreaterThan(8);
    ctx.backup = await (await world.repo.sellerBySlug('onde-onde'))?.exportBackup();
  }, 120_000);

  it.each(ROUTES.map((route) => [route.name, route] as const))(
    '%s',
    async (name, route) => {
      if (name === 'GET seller/past-weeks/:id') {
        const week = await world.db.first<{ id: string }>('SELECT id FROM past_weeks LIMIT 1');
        ctx.weekId = week?.id ?? 'none';
      }
      const { response, trips, statements } = await call(route);
      expect(response?.status).toBe(route.status ?? 200);
      results.set(name, { trips, statements });
      const message = `${name}: ${String(trips)} trips, ${String(statements)} statements`;
      expect(trips, message).toBeLessThan(LIMIT);
      // Counting every statement of a batch too (the strict reading of the limit), except for the
      // two routes that write a row for each order.
      if (!route.bulk) expect(statements, message).toBeLessThan(LIMIT);
    },
    60_000,
  );

  it('prints the table', () => {
    const lines = [...results].map(
      ([name, r]) =>
        `${name.padEnd(40)} ${String(r.trips).padStart(4)} trips ${String(r.statements).padStart(5)} stmts`,
    );
    // A file, not the console: the test setup keeps the console quiet.
    writeFileSync(
      process.env['QUERY_TABLE'] ?? 'scratch/s84b-query-table.txt',
      `${lines.join('\n')}\n`,
    );
  });
});
