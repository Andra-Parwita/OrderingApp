// @vitest-environment node
// D-094: POST /menus/current/items appends one library dish to the menu without touching the rest.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { MAX_MENU_ITEMS } from '../shared/limits';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('chef adds her own dish to the menu (D-094)', () => {
  const create = useWorld('chefaddmenu');
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

  async function setup() {
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
    const helperKey = await world.repo.auth.createKey({
      role: 'helper',
      sellerId: SELLER_ID,
      displayName: 'Hana',
    });
    const helper = await newPerson(helperKey.key, 'helper-001-cccc', 'helper long password');
    const budi = (
      (await call('POST', '/api/seller/chefs', { token: owner.token, body: { name: 'Budi' } }))
        .body as { chef: { id: string } }
    ).chef.id;
    return { owner, wati, helper, budi };
  }
  const mk = async (token: string, name: string, chefId?: string) =>
    (
      (
        await call('POST', '/api/seller/dishes', {
          token,
          body: { name: { en: name, id: name }, priceCents: 1000, ...(chefId ? { chefId } : {}) },
        })
      ).body as { dish: { id: string } }
    ).dish.id;
  const add = (token: string, dishId: string) =>
    call('POST', '/api/seller/menus/current/items', { token, body: { dishId } });
  const menuDishes = async (token: string) =>
    (
      (await call('GET', '/api/seller/menus/current', { token })).body as {
        menu: { dishes: Array<{ name: { en: string }; dishId?: string }> };
      }
    ).menu.dishes;

  it('a chef appends her own dish to a menu that holds a non-library item, live or draft', async () => {
    const { owner, wati } = await setup();
    // Deleting a library dish leaves its copy on the menu, now without a library dish.
    const library = (
      (await call('GET', '/api/seller/dishes', { token: owner.token })).body as {
        dishes: Array<{ id: string }>;
      }
    ).dishes;
    for (const dish of library) {
      await call('DELETE', `/api/seller/dishes/${dish.id}`, { token: owner.token });
    }
    const before = await menuDishes(owner.token);
    expect(before.some((d) => d.dishId === undefined)).toBe(true); // the seeded items
    const mine = await mk(wati.token, 'Wati dish');
    const reply = await add(wati.token, mine);
    expect(reply.status).toBe(201);
    const after = await menuDishes(owner.token);
    expect(after).toHaveLength(before.length + 1);
    expect(after.map((d) => d.name.en)).toEqual(
      expect.arrayContaining(before.map((d) => d.name.en)),
    );
    expect(after.some((d) => d.dishId === mine)).toBe(true);
    // Draft: unpublish, then add another.
    expect(
      (await call('POST', '/api/seller/menus/current/unpublish', { token: owner.token, body: {} }))
        .status,
    ).toBe(200);
    const second = await mk(wati.token, 'Wati dish 2');
    expect((await add(wati.token, second)).status).toBe(201);
  });

  it('refuses another chef dish, a helper, publish and finish for a chef; a duplicate is 409', async () => {
    const { owner, wati, helper, budi } = await setup();
    const others = await mk(owner.token, 'Budi dish', budi);
    const kitchen = await mk(owner.token, 'Kitchen dish');
    const mine = await mk(wati.token, 'Wati dish');
    expect((await add(wati.token, others)).status).toBe(403);
    expect((await add(wati.token, kitchen)).status).toBe(403);
    expect((await add(wati.token, 'nope')).status).toBe(403);
    expect((await add(helper.token, mine)).status).toBe(403);
    expect((await add(wati.token, mine)).status).toBe(201);
    const twice = await add(wati.token, mine);
    expect(twice.status).toBe(409);
    expect((twice.body as { error: string }).error).toBe('already_on_menu');
    expect(
      (
        await call('PUT', '/api/seller/menus/current', {
          token: wati.token,
          body: { dishIds: [mine] },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call('POST', '/api/seller/menus/current/publish', { token: wati.token, body: {} }))
        .status,
    ).toBe(403);
    expect(
      (await call('POST', '/api/seller/menus/current/finish', { token: wati.token, body: {} }))
        .status,
    ).toBe(403);
    // The owner may add any library dish.
    expect((await add(owner.token, others)).status).toBe(201);
  });

  it('refuses a full menu and a finished menu', async () => {
    const { owner } = await setup();
    let status = 201;
    for (let i = 0; status === 201 && i < MAX_MENU_ITEMS + 2; i += 1) {
      status = (await add(owner.token, await mk(owner.token, `Dish ${String(i)}`))).status;
    }
    expect(status).toBe(409);
    expect(
      (await call('POST', '/api/seller/menus/current/finish', { token: owner.token, body: {} }))
        .status,
    ).toBe(200);
    expect((await add(owner.token, await mk(owner.token, 'Late'))).status).toBe(409);
  });
});
