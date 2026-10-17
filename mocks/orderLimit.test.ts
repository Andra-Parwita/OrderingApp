// @vitest-environment node
// Plan 089 #5: 5 customer orders per 10 minutes per kitchen per client (the signed-in account, else
// the salted network key). Seller-entered orders are not limited; no raw address is stored.
import { beforeEach, describe, expect, it } from 'vitest';
import { handleApiRequest } from '../worker/api/routes';
import { devApi, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const A = 'onde-onde';
const B = 'dapur-demo';
const IP = '203.0.113.50';
const IP2 = '203.0.113.51';
const START = Date.parse('2026-10-07T10:00:00Z');
const MIN = 60_000;

describe('order placing limit (plan 089 #5)', () => {
  const create = useWorld('orderLimit');
  let world: World;
  let now = START;

  type Reply = { status: number; body: unknown };
  async function call(
    method: string,
    path: string,
    options: { ip?: string; customer?: string; seller?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.ip) headers['CF-Connecting-IP'] = options.ip;
    if (options.customer) headers['Cookie'] = `__Host-customer=${options.customer}`;
    if (options.seller) headers['X-Seller'] = options.seller;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const request = new Request(`${SITE}${path}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    // Customer routes run as in production (dev tools off); the seller route needs the X-Seller header.
    const response = options.seller
      ? await devApi(world.repo, request)
      : await handleApiRequest(world.repo, request, {});
    if (!response) throw new Error(`no route for ${method} ${path}`);
    return { status: response.status, body: (await response.json()) as unknown };
  }

  const itemOf = async (slug: string): Promise<string> => {
    const menu = (await call('GET', `/api/s/${slug}/menu`)).body as {
      items: Array<{ id: string; limit?: number }>;
    };
    const item = menu.items.find((candidate) => candidate.limit === undefined);
    if (!item) throw new Error('no unlimited dish');
    return item.id;
  };
  const order = async (slug: string, options: { ip?: string; customer?: string } = {}) =>
    call('POST', `/api/s/${slug}/orders`, {
      ...options,
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: await itemOf(slug), qty: 1 }],
      },
    });
  const fill = async (slug: string, options: { ip?: string; customer?: string }) => {
    for (let n = 0; n < 5; n += 1) expect((await order(slug, options)).status).toBe(201);
  };

  beforeEach(async () => {
    now = START;
    world = await create({ now: () => new Date(now) });
  });

  it('allows 5 and refuses the 6th with 429 too_many_orders; the window then resets', async () => {
    await fill(A, { ip: IP });
    const sixth = await order(A, { ip: IP });
    expect(sixth.status).toBe(429);
    expect((sixth.body as { error: string }).error).toBe('too_many_orders');
    expect((sixth.body as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    now += 9 * MIN;
    expect((await order(A, { ip: IP })).status).toBe(429);
    now += 2 * MIN;
    expect((await order(A, { ip: IP })).status).toBe(201);
  });

  it('does not touch another kitchen, another network, or a request with no address', async () => {
    await fill(A, { ip: IP });
    expect((await order(A, { ip: IP })).status).toBe(429);
    expect((await order(B, { ip: IP })).status).toBe(201);
    expect((await order(A, { ip: IP2 })).status).toBe(201);
    for (let n = 0; n < 7; n += 1) expect((await order(A)).status).toBe(201);
  });

  it('with dev tools on the limit is off unless X-Dev-Order-Limit: on; with them off the header is ignored', async () => {
    const itemId = await itemOf(A);
    const body = JSON.stringify({
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId, qty: 1 }],
    });
    const place = (dev: boolean, header: boolean) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (header) headers['X-Dev-Order-Limit'] = 'on';
      const request = new Request(`${SITE}/api/s/${A}/orders`, { method: 'POST', headers, body });
      return handleApiRequest(world.repo, request, { devTools: dev });
    };
    // Dev tools on, no header: never limited (even from one address).
    for (let n = 0; n < 7; n += 1) expect((await place(true, false))?.status).toBe(201);
    // Dev tools on, header on: the real limit (5 per 10 minutes, one shared dev client).
    for (let n = 0; n < 5; n += 1) expect((await place(true, true))?.status).toBe(201);
    expect((await place(true, true))?.status).toBe(429);
    // Dev tools off: the header changes nothing (no address, so no limit at all).
    for (let n = 0; n < 7; n += 1) expect((await place(false, true))?.status).toBe(201);
  });

  it('does not limit seller-entered orders', async () => {
    const itemId = await itemOf(A);
    for (let n = 0; n < 8; n += 1) {
      const reply = await call('POST', '/api/seller/orders', {
        seller: A,
        ip: IP,
        body: {
          firstName: 'Tono',
          language: 'id',
          fulfilment: 'pickup',
          lines: [{ itemId, qty: 1 }],
        },
      });
      expect(reply.status, JSON.stringify(reply.body)).toBe(201);
    }
  });

  it('keys a signed-in customer on the account, not the shared network', async () => {
    const phone = new SoftAuthenticator(SITE);
    const asked = await call('POST', '/api/customer/register/options', {
      body: { deviceId: 'phone-aaaa-0001', firstName: 'Rina' },
    });
    const options = (asked.body as { options: Record<string, unknown> }).options;
    const registered = await devApi(
      world.repo,
      new Request(`${SITE}/api/customer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'phone-aaaa-0001',
          response: phone.create(options as never),
          tokens: [],
          adopt: [],
          prf: false,
          firstName: 'Rina',
        }),
      }),
    );
    expect(registered?.status).toBe(201);
    const customer = /__Host-customer=([^;]+)/.exec(
      registered?.headers.get('set-cookie') ?? '',
    )?.[1];
    if (!customer) throw new Error('no customer cookie');
    await fill(A, { ip: IP, customer });
    expect((await order(A, { ip: IP, customer })).status).toBe(429);
    // The same Wi-Fi without the account still has its own 5.
    expect((await order(A, { ip: IP })).status).toBe(201);
  });

  it('stores no raw address in the limiter rows', async () => {
    await order(A, { ip: IP });
    const rows = await world.db.all<{ scope: string }>(
      "SELECT scope FROM auth_rate WHERE scope LIKE 'order:%'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.scope).toMatch(/^order:[^:]+:ip:[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(IP);
  });
});
