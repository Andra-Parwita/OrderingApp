// @vitest-environment node
// Plan 030, stage 1: a chef adds and edits their own dishes, and nothing else on the menu.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('chef own dishes (plan 030)', () => {
  const create = useWorld('chefdishes');
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

  const dish = (name: string, chefId?: string) => ({
    name: { en: name, id: name },
    priceCents: 5000,
    ...(chefId ? { chefId } : {}),
  });

  /** The owner, chef Wati signed in, and a second chef (Budi) with a dish of his own. */
  async function people() {
    const ownerKey = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'Olive',
    });
    const owner = await newPerson(ownerKey.key, 'owner-0001-aaaa', 'correct horse battery');
    const invite = await call('POST', '/api/seller/chef-invites', {
      token: owner.token,
      body: { chefId: 'wati' },
    });
    const wati = await newPerson(keyOf(invite).key, 'wati-0001-bbbb', 'chef long password');
    const budi = (
      (await call('POST', '/api/seller/chefs', { token: owner.token, body: { name: 'Budi' } }))
        .body as { chef: { id: string } }
    ).chef.id;
    const budiDish = (
      (
        await call('POST', '/api/seller/dishes', {
          token: owner.token,
          body: dish('Budi soup', budi),
        })
      ).body as { dish: { id: string } }
    ).dish.id;
    return { owner, wati, budi, budiDish };
  }

  const dishOf = (reply: Reply) => (reply.body as { dish: { id: string; chefId?: string } }).dish;

  it('a chef adds a dish and it is forced to them, whatever the body says', async () => {
    const { wati, budi } = await people();
    const own = await call('POST', '/api/seller/dishes', {
      token: wati.token,
      body: dish('Lumpia'),
    });
    expect(own.status).toBe(201);
    expect(dishOf(own).chefId).toBe('wati');
    const other = await call('POST', '/api/seller/dishes', {
      token: wati.token,
      body: dish('Sneaky', budi),
    });
    expect(other.status).toBe(201);
    expect(dishOf(other).chefId).toBe('wati');
    const none = await call('POST', '/api/seller/dishes', {
      token: wati.token,
      body: { ...dish('Kitchen'), chefId: undefined },
    });
    expect(dishOf(none).chefId).toBe('wati');
  });

  it('a chef edits their own dish and sells it out on the menu; keeping their own chef is fine', async () => {
    const { wati } = await people();
    const id = dishOf(
      await call('POST', '/api/seller/dishes', { token: wati.token, body: dish('Lumpia') }),
    ).id;
    const edit = await call('PATCH', `/api/seller/dishes/${id}`, {
      token: wati.token,
      body: { priceCents: 7000, chefId: 'wati' },
    });
    expect(edit.status).toBe(200);
    expect((edit.body as { dish: { priceCents: number } }).dish.priceCents).toBe(7000);
    // A menu item of theirs (seeded): sold out is allowed.
    const itemId = 'lemper';
    expect(
      (
        await call('PATCH', `/api/seller/menu/items/${itemId}`, {
          token: wati.token,
          body: { soldOut: true },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('PATCH', `/api/seller/menu/items/${itemId}`, {
          token: wati.token,
          body: { chefId: 'other' },
        })
      ).status,
    ).toBe(403);
    // 'ayam-goreng' has no chef: not theirs.
    const notOwn = await call('PATCH', '/api/seller/menu/items/ayam-goreng', {
      token: wati.token,
      body: { soldOut: true },
    });
    expect(notOwn.status).toBe(403);
  });

  it("refuses another chef's dish, a dish of the whole kitchen, and any reassigning", async () => {
    const { owner, wati, budi, budiDish } = await people();
    const own = dishOf(
      await call('POST', '/api/seller/dishes', { token: wati.token, body: dish('Lumpia') }),
    ).id;
    const kitchenDish = dishOf(
      await call('POST', '/api/seller/dishes', { token: owner.token, body: dish('Everyone') }),
    ).id;
    for (const id of [budiDish, kitchenDish, 'nope']) {
      const reply = await call('PATCH', `/api/seller/dishes/${id}`, {
        token: wati.token,
        body: { priceCents: 1 },
      });
      expect(reply.status).toBe(403);
    }
    for (const chefId of [budi, 'wati-not']) {
      const reply = await call('PATCH', `/api/seller/dishes/${own}`, {
        token: wati.token,
        body: { chefId },
      });
      expect(reply.status).toBe(403);
    }
    const stored = (await call('GET', '/api/seller/dishes', { token: owner.token })).body as {
      dishes: Array<{ id: string; chefId?: string; priceCents: number }>;
    };
    expect(stored.dishes.find((d) => d.id === budiDish)?.priceCents).toBe(5000);
    expect(stored.dishes.find((d) => d.id === own)?.chefId).toBe('wati');
  });

  it('a chef cannot delete a dish, publish or close a menu, or touch the menu list', async () => {
    const { wati, budiDish } = await people();
    const own = dishOf(
      await call('POST', '/api/seller/dishes', { token: wati.token, body: dish('Lumpia') }),
    ).id;
    const denied: Array<[string, string]> = [
      ['DELETE', `/api/seller/dishes/${own}`],
      ['DELETE', `/api/seller/dishes/${budiDish}`],
      ['POST', '/api/seller/menus/current/publish'],
      ['POST', '/api/seller/menus/current/unpublish'],
      ['POST', '/api/seller/menus/current/finish'],
      ['PUT', '/api/seller/menus/current'],
      ['POST', '/api/seller/saved-sets'],
      ['POST', '/api/seller/menu/items'],
    ];
    for (const [method, path] of denied) {
      const reply = await call(method, path, { token: wati.token, body: dish('x') });
      expect([method, path, reply.status]).toEqual([method, path, 403]);
    }
    expect((await call('GET', '/api/seller/dishes', { token: wati.token })).status).toBe(200);
  });

  it('the owner is unchanged: edits and reassigns any dish, and deletes', async () => {
    const { owner, wati, budiDish } = await people();
    const edit = await call('PATCH', `/api/seller/dishes/${budiDish}`, {
      token: owner.token,
      body: { chefId: 'wati' },
    });
    expect(dishOf(edit).chefId).toBe('wati');
    expect((await call('DELETE', `/api/seller/dishes/${budiDish}`, owner)).status).toBe(200);
    expect(wati.me.role).toBe('chef');
  });
});
