// @vitest-environment node
// Plan 098 C2: the role matrix. Every route the API answers (method + path) is called as each kind of
// caller (no session, a customer cookie, helper, chef, owner, admin, and the DEV_TOOLS header call
// with no session) and the status is written down. The snapshot below was taken on the code BEFORE
// routes.ts was split and the chef / helper deny-lists became per-route allow-lists; it must come
// out identical afterwards, so the split changed no permission. A new route is a new line here.
// To refresh it on purpose (a new route, a ruling): `npx vitest run mocks/roleMatrix -u`.
import { describe, expect, it } from 'vitest';
import { handleApiRequest, type RouteContext } from '../worker/api/routes';
import type { LiveNotifier } from '../worker/live/hub';
import { DEV_ADMIN_SETUP_KEY, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const SLUG = 'onde-onde';
const SELLER_ID = 'seller-onde-onde';

type Probe = { method: string; path: string; body?: unknown; ws?: boolean };
type Ids = { code: string; own: string; other: string; ownItem: string; otherItem: string };

const live: LiveNotifier = {
  notify: () => Promise.resolve(),
  connect: () => Promise.resolve(new Response('room')),
  connectCustomer: () => Promise.resolve(new Response('room')),
};

/** Every route, with the placeholders {code} {own} {other} {item} filled from the sample kitchen. */
function probes(): Array<Probe> {
  const S = '/api/seller';
  const p = (method: string, path: string, body?: unknown, ws?: boolean): Probe => ({
    method,
    path,
    ...(body !== undefined ? { body } : {}),
    ...(ws ? { ws } : {}),
  });
  return [
    // public
    p('GET', '/api/status'),
    p('GET', '/api/notes?audience=sellers'),
    p('GET', '/api/notes'),
    p('POST', '/api/maintenance', { on: true }),
    p('GET', `/api/s/${SLUG}/menu`),
    p('GET', '/api/s/nobody/menu'),
    p('GET', `/api/s/${SLUG}/live`),
    p('GET', `/api/s/${SLUG}/live?tokens=x`, undefined, true),
    p('POST', `/api/s/${SLUG}/orders`, {}),
    p('GET', `/api/s/${SLUG}/team-names`),
    p('POST', `/api/s/${SLUG}/orders/find`, {}),
    p('GET', `/api/s/${SLUG}/other`),
    p('GET', '/api/orders?tokens=x'),
    p('GET', '/api/orders'),
    p('GET', '/api/orders/tok'),
    p('PATCH', '/api/orders/tok', {}),
    p('POST', '/api/orders/tok/collected', {}),
    p('POST', '/api/orders/tok/push', {}),
    p('DELETE', '/api/orders/tok/push', {}),
    p('POST', '/api/orders/tok/cancel', {}),
    p('GET', '/api/push/public-key'),
    p('POST', '/api/log', {}),
    p('GET', '/api/auth/me'),
    p('GET', '/api/auth/memberships'),
    p('GET', '/api/customer/me'),
    p('GET', '/api/admin/sellers'),
    p('GET', '/api/admin/log'),
    p('GET', '/api/seller/live'),
    p('GET', '/api/seller/live', undefined, true),
    p('POST', '/api/seller/live'),
    // seller: orders
    p('GET', `${S}/orders`),
    p('POST', `${S}/orders`, {}),
    p('GET', `${S}/orders/{code}`),
    p('PATCH', `${S}/orders/{code}`, {}),
    p('POST', `${S}/orders/{code}/status`, { to: 'confirmed' }),
    p('POST', `${S}/orders/{code}/status`, { to: 'cancelled' }),
    p('PATCH', `${S}/orders/{code}/fulfilment`, {}),
    p('POST', `${S}/orders/{code}/delete-address`, {}),
    p('POST', `${S}/orders/{code}/pack`, {}),
    p('POST', `${S}/orders/{code}/delivery-step`, {}),
    p('POST', `${S}/orders/{code}/collected`, {}),
    p('POST', `${S}/orders/{code}/paid`, {}),
    p('POST', `${S}/orders/{code}/lock`, {}),
    p('POST', `${S}/orders/{code}/wa-received`, {}),
    p('POST', `${S}/orders/{code}/address-seen`, {}),
    p('POST', `${S}/orders/{code}/nudge`, {}),
    p('POST', `${S}/orders/{code}/seen`, {}),
    p('DELETE', `${S}/orders/{code}`),
    p('GET', `${S}/orders.csv`),
    p('GET', `${S}/messages`),
    p('POST', `${S}/messages/place/x`, {}),
    p('POST', `${S}/updates`, {}),
    p('GET', `${S}/made`),
    p('POST', `${S}/made`, {}),
    p('POST', `${S}/translate`, {}),
    p('POST', `${S}/day/sale`, {}),
    p('POST', `${S}/day/count`, {}),
    p('POST', `${S}/day/undo`, {}),
    p('GET', `${S}/day/log`),
    p('POST', `${S}/demo/samples`),
    p('DELETE', `${S}/demo/samples`),
    // seller: private orders
    p('GET', `${S}/private`),
    p('GET', `${S}/private?view=bad`),
    p('GET', `${S}/private/chef-summary?date=2026-10-10`),
    p('POST', `${S}/private`, {}),
    p('PATCH', `${S}/private/{code}`, {}),
    p('POST', `${S}/private/{code}/cancel`),
    // seller: menu and dishes
    p('GET', `${S}/menu`),
    p('PATCH', `${S}/menu/items/{ownItem}`, { soldOut: true }),
    p('PATCH', `${S}/menu/items/{otherItem}`, { soldOut: true }),
    p('PATCH', `${S}/menu/items/{ownItem}`, { soldOut: true, name: 'x' }),
    p('PATCH', `${S}/menu/items/{ownItem}`, { soldOut: true, chefId: 'someone-else' }),
    p('GET', `${S}/menus/current`),
    p('GET', `${S}/menus/x/chef-summary`),
    p('POST', `${S}/menus`, {}),
    p('PUT', `${S}/menus/current`, {}),
    p('POST', `${S}/menus/current/items`, { dishId: '{own}' }),
    p('POST', `${S}/menus/current/items`, { dishId: '{other}' }),
    p('POST', `${S}/menus/current/publish`, {}),
    p('POST', `${S}/menus/current/unpublish`),
    p('PUT', `${S}/menus/current/picture`, {}),
    p('DELETE', `${S}/menus/current/picture`),
    p('POST', `${S}/menus/current/finish`),
    p('GET', `${S}/dishes`),
    p('POST', `${S}/dishes/import`, {}),
    p('POST', `${S}/dishes`, {}),
    p('PATCH', `${S}/dishes/{own}`, {}),
    p('PATCH', `${S}/dishes/{other}`, {}),
    p('PATCH', `${S}/dishes/{own}`, { chefId: 'someone-else' }),
    p('PUT', `${S}/dishes/{own}/picture`, {}),
    p('PUT', `${S}/dishes/{other}/picture`, {}),
    p('DELETE', `${S}/dishes/{own}/picture`),
    p('DELETE', `${S}/dishes/{other}/picture`),
    p('GET', `${S}/saved-sets`),
    p('POST', `${S}/saved-sets`, {}),
    p('POST', `${S}/saved-sets/x/use`),
    p('GET', `${S}/pickup-places`),
    p('POST', `${S}/pickup-places`, {}),
    p('PATCH', `${S}/pickup-places/x`, {}),
    p('DELETE', `${S}/pickup-places/x`),
    p('GET', `${S}/preferences`),
    p('PUT', `${S}/preferences`, {}),
    // seller: kitchen, people, data
    p('GET', `${S}/settings`),
    p('PUT', `${S}/settings`, {}),
    p('PUT', `${S}/kitchen/name`, {}),
    p('GET', `${S}/past-weeks`),
    p('GET', `${S}/past-weeks/x`),
    p('GET', `${S}/chefs`),
    p('POST', `${S}/chefs`, {}),
    p('PATCH', `${S}/chefs/x`, {}),
    p('DELETE', `${S}/chefs/x`),
    p('GET', `${S}/images`),
    p('PUT', `${S}/images`, {}),
    p('PUT', `${S}/images/desktopBanner`, {}),
    p('DELETE', `${S}/images/desktopBanner`),
    p('GET', `${S}/backup`),
    p('POST', `${S}/backup`, {}),
    p('POST', `${S}/chef-invites`, {}),
    p('POST', `${S}/invites`, {}),
    p('GET', `${S}/chef-devices`),
    p('GET', `${S}/team`),
    p('DELETE', `${S}/team/x`),
    p('GET', `${S}/nothing-here`),
    p('POST', `${S}/nothing-here`, {}),
    // destructive last
    p('DELETE', `${S}/menus/current`),
    p('DELETE', `${S}/dishes/{own}`),
    p('DELETE', `${S}/dishes/{other}`),
    // dev
    p('GET', '/api/dev/sellers'),
    p('POST', '/api/dev/sample-orders', { count: 1 }),
    p('POST', '/api/dev/reset'),
  ];
}

const ROLES = ['none', 'customer', 'helper', 'chef', 'owner', 'admin', 'dev'] as const;
type Kind = (typeof ROLES)[number];

describe('role matrix (plan 098 C2)', () => {
  const create = useWorld('role-matrix');
  const authenticator = new SoftAuthenticator(SITE);
  let world: World;
  let tokens = 0;

  async function send(
    probe: Probe,
    ids: Ids,
    cookie: string | undefined,
    context: RouteContext,
  ): Promise<number | 'null'> {
    const fill = (text: string) =>
      text
        .replace('{code}', ids.code)
        .replace('{own}', ids.own)
        .replace('{other}', ids.other)
        .replace('{ownItem}', ids.ownItem)
        .replace('{otherItem}', ids.otherItem);
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    if (probe.ws) headers['Upgrade'] = 'websocket';
    const init: RequestInit = { method: probe.method, headers };
    if (probe.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = fill(JSON.stringify(probe.body));
    }
    const response = await handleApiRequest(
      world.repo,
      new Request(`${SITE}${fill(probe.path)}`, init),
      context,
    );
    return response ? response.status : 'null';
  }

  async function json(
    method: string,
    path: string,
    cookie?: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown; token: string }> {
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await handleApiRequest(
      world.repo,
      new Request(`${SITE}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      { devTools: true },
    );
    const text = (await response?.text()) ?? '';
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON
    }
    const set = response?.headers.get('set-cookie') ?? '';
    return {
      status: response?.status ?? -1,
      body: parsed,
      token: /__Host-session=([^;]+)/.exec(set)?.[1] ?? '',
    };
  }

  async function person(
    role: 'owner' | 'chef' | 'helper',
    deviceId: string,
    chefId?: string,
  ): Promise<string> {
    const key = await world.repo.auth.createKey({
      role,
      sellerId: SELLER_ID,
      displayName: `Test ${role}`,
      ...(chefId ? { chefId } : {}),
    });
    const setup = await json('POST', '/api/auth/invite', undefined, { key: key.key, deviceId });
    const full = await json('POST', '/api/auth/register', `__Host-session=${setup.token}`, {
      kind: 'password',
      password: 'correct horse battery',
      deviceName: 'Phone',
    });
    if (!full.token) throw new Error(`no session for ${role}: ${JSON.stringify(full)}`);
    return `__Host-session=${full.token}`;
  }

  async function admin(): Promise<string> {
    const setup = await json('POST', '/api/admin/setup', undefined, {
      setupKey: DEV_ADMIN_SETUP_KEY,
      deviceId: 'device-aaaa-0001',
    });
    const cookie = `__Host-session=${setup.token}`;
    const asked = await json('POST', '/api/auth/register/options', cookie);
    const options = (asked.body as { options: Record<string, unknown> }).options;
    const done = await json('POST', '/api/auth/register', cookie, {
      kind: 'passkey',
      deviceName: 'Laptop',
      response: authenticator.create(options as never),
    });
    if (!done.token) throw new Error(`no admin session: ${JSON.stringify(done)}`);
    return `__Host-session=${done.token}`;
  }

  async function run(kind: Kind): Promise<Array<string>> {
    tokens = 0;
    authenticator.credentials.length = 0;
    await world.reset();
    const owner = await person('owner', 'owner-0001-aaaa');
    // Something to point at: one order, a cook with a dish, someone else's dish, a menu item.
    await json('POST', `/api/s/${SLUG}/orders`, undefined, {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    const orders = (await json('GET', '/api/seller/orders', owner)).body as {
      orders: Array<{ code: string }>;
    };
    const chefs = (await json('GET', '/api/seller/chefs', owner)).body as {
      chefs: Array<{ id: string }>;
    };
    const chefId = chefs.chefs[0]?.id ?? '';
    const dishes = (await json('GET', '/api/seller/dishes', owner)).body as {
      dishes: Array<{ id: string; chefId?: string }>;
    };
    const menu = (await json('GET', '/api/seller/menu', owner)).body as {
      items: Array<{ id: string; chefId?: string }>;
    };
    const ids: Ids = {
      code: orders.orders[0]?.code ?? 'AAA-AAA',
      own: dishes.dishes.find((d) => d.chefId === chefId)?.id ?? 'none',
      other: dishes.dishes.find((d) => d.chefId !== chefId)?.id ?? 'none',
      ownItem: menu.items.find((i) => i.chefId === chefId)?.id ?? 'none',
      otherItem: menu.items.find((i) => i.chefId !== chefId)?.id ?? 'none',
    };
    let cookie: string | undefined;
    if (kind === 'owner') cookie = owner;
    if (kind === 'helper') cookie = await person('helper', 'helper-0001-bb');
    if (kind === 'chef') cookie = await person('chef', 'chef-0001-cccc', chefId);
    if (kind === 'admin') cookie = await admin();
    if (kind === 'customer') cookie = '__Host-customer=not-a-real-customer-session';
    const context: RouteContext = { live, ...(kind === 'dev' ? { devTools: true } : {}) };
    const lines: Array<string> = [];
    for (const probe of probes()) {
      const status = await send(probe, ids, cookie, context);
      lines.push(`${status}`);
    }
    return lines;
  }

  it('every route answers each role as it does today', async () => {
    world = await create({
      now: () => new Date('2026-10-07T10:00:00Z'),
      newToken: () => `token-${String(++tokens)}`,
    });
    const columns = new Map<Kind, Array<string>>();
    for (const kind of ROLES) columns.set(kind, await run(kind));
    const table = probes().map((probe, row) => {
      const cells = ROLES.map((kind) => `${kind} ${columns.get(kind)?.[row] ?? '?'}`);
      const label = `${probe.method} ${probe.path}${probe.ws ? ' (ws)' : ''}${
        probe.body !== undefined ? ` ${JSON.stringify(probe.body).slice(0, 40)}` : ''
      }`;
      return `${label} | ${cells.join(' | ')}`;
    });
    expect(table.length).toBe(probes().length);
    expect(table.join('\n')).toMatchInlineSnapshot(`
      "GET /api/status | none 200 | customer 200 | helper 200 | chef 200 | owner 200 | admin 200 | dev 200
      GET /api/notes?audience=sellers | none 200 | customer 200 | helper 200 | chef 200 | owner 200 | admin 200 | dev 200
      GET /api/notes | none 400 | customer 400 | helper 400 | chef 400 | owner 400 | admin 400 | dev 400
      POST /api/maintenance {"on":true} | none 401 | customer 401 | helper 401 | chef 401 | owner 401 | admin 401 | dev 401
      GET /api/s/onde-onde/menu | none 200 | customer 200 | helper 200 | chef 200 | owner 200 | admin 200 | dev 200
      GET /api/s/nobody/menu | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      GET /api/s/onde-onde/live | none 426 | customer 426 | helper 426 | chef 426 | owner 426 | admin 426 | dev 426
      GET /api/s/onde-onde/live?tokens=x (ws) | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      POST /api/s/onde-onde/orders {} | none 400 | customer 400 | helper 400 | chef 400 | owner 400 | admin 400 | dev 400
      GET /api/s/onde-onde/team-names | none 200 | customer 200 | helper 200 | chef 200 | owner 200 | admin 200 | dev 200
      POST /api/s/onde-onde/orders/find {} | none 400 | customer 400 | helper 400 | chef 400 | owner 400 | admin 400 | dev 400
      GET /api/s/onde-onde/other | none null | customer null | helper null | chef null | owner null | admin null | dev null
      GET /api/orders?tokens=x | none 200 | customer 200 | helper 200 | chef 200 | owner 200 | admin 200 | dev 200
      GET /api/orders | none 400 | customer 400 | helper 400 | chef 400 | owner 400 | admin 400 | dev 400
      GET /api/orders/tok | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      PATCH /api/orders/tok {} | none 400 | customer 400 | helper 400 | chef 400 | owner 400 | admin 400 | dev 400
      POST /api/orders/tok/collected {} | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      POST /api/orders/tok/push {} | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      DELETE /api/orders/tok/push {} | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      POST /api/orders/tok/cancel {} | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      GET /api/push/public-key | none 404 | customer 404 | helper 404 | chef 404 | owner 404 | admin 404 | dev 404
      POST /api/log {} | none 403 | customer 403 | helper 403 | chef 403 | owner 403 | admin 403 | dev 403
      GET /api/auth/me | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 200 | dev 401
      GET /api/auth/memberships | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 200 | dev 401
      GET /api/customer/me | none 401 | customer 401 | helper 401 | chef 401 | owner 401 | admin 401 | dev 401
      GET /api/admin/sellers | none 401 | customer 401 | helper 403 | chef 403 | owner 403 | admin 200 | dev 401
      GET /api/admin/log | none 401 | customer 401 | helper 403 | chef 403 | owner 403 | admin 200 | dev 401
      GET /api/seller/live | none 426 | customer 426 | helper 426 | chef 426 | owner 426 | admin 426 | dev 426
      GET /api/seller/live (ws) | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/live | none null | customer null | helper null | chef null | owner null | admin null | dev null
      GET /api/seller/orders | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/orders {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      GET /api/seller/orders/{code} | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      PATCH /api/seller/orders/{code} {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/status {"to":"confirmed"} | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/orders/{code}/status {"to":"cancelled"} | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      PATCH /api/seller/orders/{code}/fulfilment {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/delete-address {} | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/orders/{code}/pack {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/delivery-step {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/collected {} | none 401 | customer 401 | helper 409 | chef 409 | owner 409 | admin 403 | dev 409
      POST /api/seller/orders/{code}/paid {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/lock {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/wa-received {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/orders/{code}/address-seen {} | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/orders/{code}/nudge {} | none 401 | customer 401 | helper 403 | chef 409 | owner 409 | admin 403 | dev 409
      POST /api/seller/orders/{code}/seen {} | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      DELETE /api/seller/orders/{code} | none 401 | customer 401 | helper 403 | chef 403 | owner null | admin 403 | dev null
      GET /api/seller/orders.csv | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      GET /api/seller/messages | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/messages/place/x {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/updates {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      GET /api/seller/made | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/made {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/translate {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/day/sale {} | none 401 | customer 401 | helper 400 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/day/count {} | none 401 | customer 401 | helper 400 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/day/undo {} | none 401 | customer 401 | helper 400 | chef 403 | owner 400 | admin 403 | dev 400
      GET /api/seller/day/log | none 401 | customer 401 | helper 200 | chef 403 | owner 200 | admin 403 | dev 200
      POST /api/seller/demo/samples | none 401 | customer 401 | helper 403 | chef 403 | owner 403 | admin 403 | dev null
      DELETE /api/seller/demo/samples | none 401 | customer 401 | helper 403 | chef 403 | owner 403 | admin 403 | dev null
      GET /api/seller/private | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      GET /api/seller/private?view=bad | none 401 | customer 401 | helper 400 | chef 400 | owner 400 | admin 403 | dev 400
      GET /api/seller/private/chef-summary?date=2026-10-10 | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/private {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/private/{code} {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/private/{code}/cancel | none 401 | customer 401 | helper 403 | chef 403 | owner 404 | admin 403 | dev 404
      GET /api/seller/menu | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      PATCH /api/seller/menu/items/{ownItem} {"soldOut":true} | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      PATCH /api/seller/menu/items/{otherItem} {"soldOut":true} | none 401 | customer 401 | helper 200 | chef 403 | owner 200 | admin 403 | dev 200
      PATCH /api/seller/menu/items/{ownItem} {"soldOut":true,"name":"x"} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/menu/items/{ownItem} {"soldOut":true,"chefId":"someone-else"} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      GET /api/seller/menus/current | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      GET /api/seller/menus/x/chef-summary | none 401 | customer 401 | helper 403 | chef 404 | owner 404 | admin 403 | dev 404
      POST /api/seller/menus {} | none 401 | customer 401 | helper 403 | chef 403 | owner 409 | admin 403 | dev 409
      PUT /api/seller/menus/current {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/menus/current/items {"dishId":"{own}"} | none 401 | customer 401 | helper 403 | chef 409 | owner 409 | admin 403 | dev 409
      POST /api/seller/menus/current/items {"dishId":"{other}"} | none 401 | customer 401 | helper 403 | chef 403 | owner 409 | admin 403 | dev 409
      POST /api/seller/menus/current/publish {} | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      POST /api/seller/menus/current/unpublish | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      PUT /api/seller/menus/current/picture {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      DELETE /api/seller/menus/current/picture | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      POST /api/seller/menus/current/finish | none 401 | customer 401 | helper 403 | chef 403 | owner 409 | admin 403 | dev 409
      GET /api/seller/dishes | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/dishes/import {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      POST /api/seller/dishes {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/dishes/{own} {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/dishes/{other} {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/dishes/{own} {"chefId":"someone-else"} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PUT /api/seller/dishes/{own}/picture {} | none 401 | customer 401 | helper 403 | chef 400 | owner 400 | admin 403 | dev 400
      PUT /api/seller/dishes/{other}/picture {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      DELETE /api/seller/dishes/{own}/picture | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      DELETE /api/seller/dishes/{other}/picture | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      GET /api/seller/saved-sets | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/saved-sets {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/saved-sets/x/use | none 401 | customer 401 | helper 403 | chef 403 | owner 404 | admin 403 | dev 404
      GET /api/seller/pickup-places | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/pickup-places {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/pickup-places/x {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      DELETE /api/seller/pickup-places/x | none 401 | customer 401 | helper 403 | chef 403 | owner 404 | admin 403 | dev 404
      GET /api/seller/preferences | none 401 | customer 401 | helper 200 | chef 200 | owner 200 | admin 403 | dev 200
      PUT /api/seller/preferences {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      GET /api/seller/settings | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      PUT /api/seller/settings {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PUT /api/seller/kitchen/name {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      GET /api/seller/past-weeks | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      GET /api/seller/past-weeks/x | none 401 | customer 401 | helper 403 | chef 404 | owner 404 | admin 403 | dev 404
      GET /api/seller/chefs | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      POST /api/seller/chefs {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PATCH /api/seller/chefs/x {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      DELETE /api/seller/chefs/x | none 401 | customer 401 | helper 403 | chef 403 | owner 404 | admin 403 | dev 404
      GET /api/seller/images | none 401 | customer 401 | helper 403 | chef 200 | owner 200 | admin 403 | dev 200
      PUT /api/seller/images {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      PUT /api/seller/images/desktopBanner {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      DELETE /api/seller/images/desktopBanner | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      GET /api/seller/backup | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      POST /api/seller/backup {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/chef-invites {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      POST /api/seller/invites {} | none 401 | customer 401 | helper 403 | chef 403 | owner 400 | admin 403 | dev 400
      GET /api/seller/chef-devices | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      GET /api/seller/team | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev null
      DELETE /api/seller/team/x | none 401 | customer 401 | helper 403 | chef 403 | owner 404 | admin 403 | dev null
      GET /api/seller/nothing-here | none 401 | customer 401 | helper 403 | chef 403 | owner null | admin 403 | dev null
      POST /api/seller/nothing-here {} | none 401 | customer 401 | helper 403 | chef 403 | owner null | admin 403 | dev null
      DELETE /api/seller/menus/current | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      DELETE /api/seller/dishes/{own} | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      DELETE /api/seller/dishes/{other} | none 401 | customer 401 | helper 403 | chef 403 | owner 200 | admin 403 | dev 200
      GET /api/dev/sellers | none null | customer null | helper null | chef null | owner null | admin null | dev 200
      POST /api/dev/sample-orders {"count":1} | none null | customer null | helper null | chef null | owner null | admin null | dev 200
      POST /api/dev/reset | none null | customer null | helper null | chef null | owner null | admin null | dev 200"
    `);
  }, 120_000);
});
