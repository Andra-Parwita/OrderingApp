// @vitest-environment node
// Plan 028, stages 1-2: the helper role. A helper invite makes a helper membership (no cook row),
// Me and /memberships say `helper`, and the Worker lets a helper read orders, set sold out and move
// an order along, and nothing else (deny by default).
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import {
  parseKeyResponse,
  parseMembersResponse,
  parseMembershipsResponse,
  parseSessionResponse,
} from '../shared/authContract';
import { parseSellerOrderResponse, parseSellerOrdersResponse } from '../shared/orderContract';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const SLUG = 'onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('helper role (plan 028)', () => {
  const create = useWorld('helper');
  let world: World;
  let tokens = 0;

  type Reply = { status: number; body: unknown; setCookie: string | null };
  async function call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
    );
    if (!response) return { status: -1, body: null, setCookie: null };
    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');
    try {
      return { status: response.status, body: JSON.parse(text) as unknown, setCookie };
    } catch {
      return { status: response.status, body: text, setCookie };
    }
  }

  function session(reply: Reply) {
    const parsed = parseSessionResponse(reply.body);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!parsed || !token) throw new Error(`not a session: ${JSON.stringify(reply)}`);
    return { ...parsed, token };
  }
  const keyOf = (reply: Reply) => {
    const parsed = parseKeyResponse(reply.body);
    if (!parsed) throw new Error(`not a key: ${JSON.stringify(reply)}`);
    return parsed;
  };
  async function newPerson(inviteKey: string, deviceId: string, password: string) {
    const setup = session(
      await call('POST', '/api/auth/invite', { body: { key: inviteKey, deviceId } }),
    );
    return session(
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password, deviceName: 'Phone' },
      }),
    );
  }

  beforeEach(async () => {
    tokens = 0;
    world = await create({
      now: () => new Date(START),
      newToken: () => `token-${String(++tokens)}`,
    });
  });

  /** The kitchen's owner (key made straight in the repository), and a helper the owner invites. */
  async function people() {
    const ownerKey = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'Olive',
    });
    const owner = await newPerson(ownerKey.key, 'owner-0001-aaaa', 'correct horse battery');
    const invite = await call('POST', '/api/seller/invites', {
      token: owner.token,
      body: { displayName: 'Dewi', role: 'helper' },
    });
    const helper = await newPerson(keyOf(invite).key, 'helper-0001-bb', 'helper long password');
    return { owner, helper };
  }

  async function placeOrder() {
    const reply = await call('POST', `/api/s/${SLUG}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      },
    });
    expect(reply.status).toBe(201);
  }

  it('a helper invite redeems into a helper membership with no cook; Me and /memberships say helper', async () => {
    const { owner, helper } = await people();
    expect(helper.me).toMatchObject({ role: 'helper', displayName: 'Dewi', slug: SLUG });
    expect(helper.me.chefId).toBeUndefined();
    const list = parseMembershipsResponse(
      (await call('GET', '/api/auth/memberships', helper)).body,
    );
    expect(list?.memberships.map((row) => [row.slug, row.role, row.chefId])).toEqual([
      [SLUG, 'helper', undefined],
    ]);
    // No cook row was made for the helper, and the team list carries the role.
    const cooks = (await call('GET', '/api/seller/chefs', owner)).body as {
      chefs: Array<{ name: string }>;
    };
    expect(cooks.chefs.map((cook) => cook.name)).not.toContain('Dewi');
    const team = parseMembersResponse((await call('GET', '/api/seller/team', owner)).body);
    expect(team?.members.map((m) => [m.displayName, m.role, m.chefId])).toContainEqual([
      'Dewi',
      'helper',
      undefined,
    ]);
  });

  it('refuses a chef invite without a cook, and a helper invite that names one', async () => {
    await expect(
      world.repo.auth.createKey({ role: 'chef', sellerId: SELLER_ID, displayName: 'No cook' }),
    ).rejects.toThrow();
    const { owner } = await people();
    const withCook = await call('POST', '/api/seller/invites', {
      token: owner.token,
      body: { displayName: 'X', role: 'helper', chefId: 'wati' },
    });
    expect(withCook.status).toBe(400);
  });

  it('lets a helper read orders, set sold out, and move an order along, under their own name', async () => {
    const { helper } = await people();
    await placeOrder();
    const list = parseSellerOrdersResponse((await call('GET', '/api/seller/orders', helper)).body);
    const code = list?.orders[0]?.code ?? '';
    expect(code).not.toBe('');
    expect((await call('GET', `/api/seller/orders/${code}`, helper)).status).toBe(200);

    const soldOut = await call('PATCH', '/api/seller/menu/items/pesmol', {
      ...helper,
      body: { soldOut: true },
    });
    expect(soldOut.status).toBe(200);

    const moved = await call('POST', `/api/seller/orders/${code}/status`, {
      ...helper,
      body: { to: 'confirmed' },
    });
    expect(moved.status).toBe(200);
    expect(parseSellerOrderResponse(moved.body)?.order.audit[0]?.by).toEqual({
      role: 'chef',
      name: 'Dewi',
    });
    const collected = await call('POST', `/api/seller/orders/${code}/collected`, {
      ...helper,
      body: {},
    });
    expect(collected.status).not.toBe(403);
    expect(collected.status).not.toBe(401);
  });

  it('lets a helper read the menu and message log their screens show (read only)', async () => {
    const { helper } = await people();
    for (const path of [
      '/api/seller/menu',
      '/api/seller/menus/current',
      '/api/seller/messages',
      '/api/seller/preferences',
    ]) {
      expect((await call('GET', path, helper)).status, path).toBe(200);
    }
  });

  it('refuses everything else with 403, including GET backup and team', async () => {
    const { helper } = await people();
    await placeOrder();
    const code =
      parseSellerOrdersResponse((await call('GET', '/api/seller/orders', helper)).body)?.orders[0]
        ?.code ?? '';
    const forbidden: Array<[string, string, unknown?]> = [
      ['GET', '/api/seller/backup'],
      ['POST', '/api/seller/backup', {}],
      ['GET', '/api/seller/team'],
      ['DELETE', '/api/seller/team/x'],
      ['POST', '/api/seller/invites', { displayName: 'X', role: 'helper' }],
      ['POST', '/api/seller/chef-invites', { chefId: 'wati' }],
      ['GET', '/api/seller/chef-devices'],
      ['GET', '/api/seller/past-weeks'],
      ['GET', '/api/seller/chefs'],
      ['GET', '/api/seller/settings'],
      ['PUT', '/api/seller/settings', {}],
      ['PUT', '/api/seller/preferences', {}],
      ['POST', '/api/seller/menus/current/publish'],
      ['POST', '/api/seller/dishes', {}],
      ['PUT', '/api/seller/made', {}],
      ['POST', '/api/seller/made', {}],
      ['POST', '/api/seller/chefs', {}],
      ['POST', '/api/seller/updates', {}],
      ['POST', '/api/seller/demo/samples'],
      ['DELETE', '/api/seller/demo/samples'],
      ['POST', '/api/seller/orders', {}],
      ['GET', '/api/seller/orders.csv'],
      ['POST', `/api/seller/orders/${code}/paid`, { paid: true }],
      ['POST', `/api/seller/orders/${code}/pack`, {}],
      ['POST', `/api/seller/orders/${code}/lock`, {}],
      ['POST', `/api/seller/orders/${code}/delivery-step`, {}],
      // The item PATCH also edits name and price: only the sold-out switch alone is allowed.
      ['PATCH', '/api/seller/menu/items/pesmol', { priceCents: 1 }],
      ['PATCH', '/api/seller/menu/items/pesmol', { soldOut: true, priceCents: 1 }],
      ['PATCH', '/api/seller/menu/items/pesmol', {}],
    ];
    for (const [method, path, body] of forbidden) {
      const reply = await call(method, path, {
        ...helper,
        ...(body !== undefined ? { body } : {}),
      });
      expect(reply.status, `${method} ${path}`).toBe(403);
      expect(parseApiError(reply.body)?.error, `${method} ${path}`).toBe('forbidden');
    }
  });

  it('leaves the owner unchanged: the same reads work for the owner', async () => {
    const { owner } = await people();
    for (const path of ['/api/seller/backup', '/api/seller/team', '/api/seller/menu']) {
      expect((await call('GET', path, owner)).status, path).toBe(200);
    }
  });
});
