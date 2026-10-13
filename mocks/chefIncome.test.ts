// @vitest-environment node
// Plan 069 stage 1 (server): portions and income per chef for the current menu, who sees what, the
// kitchen setting, and one database round trip.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { parseChefSummaryResponse } from '../shared/chefSummaryContract';
import { runAutoFinish } from '../worker/api/scheduled';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const SLUG = 'onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('per-chef portions and income (plan 069, server)', () => {
  const create = useWorld('chef-income');
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
      new Request(`https://chef-income.test${path}`, {
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

  /** The owner, a helper and a chef (Wati), each signed in. */
  async function people() {
    const ownerKey = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'Olive',
    });
    const owner = await newPerson(ownerKey.key, 'owner-0001-aaaa', 'correct horse battery');
    const helperInvite = await call('POST', '/api/seller/invites', {
      token: owner.token,
      body: { displayName: 'Dewi', role: 'helper' },
    });
    const helper = await newPerson(
      keyOf(helperInvite).key,
      'helper-0001-bb',
      'helper long password',
    );
    const chefInvite = await call('POST', '/api/seller/chef-invites', {
      token: owner.token,
      body: { chefId: 'wati' },
    });
    const chef = await newPerson(keyOf(chefInvite).key, 'wati-0001-bbbb', 'chef long password');
    return { owner, helper, chef };
  }

  type Person = { token: string };
  const get = (who: Person, id = 'current') =>
    call('GET', `/api/seller/menus/${id}/chef-summary`, { token: who.token });
  const order = (lines: Array<{ itemId: string; qty: number }>) =>
    call('POST', `/api/s/${SLUG}/orders`, {
      body: { firstName: 'Rina', language: 'en', fulfilment: 'pickup', lines },
    });
  const summary = (reply: Reply) => {
    const parsed = parseChefSummaryResponse(reply.body);
    if (!parsed) throw new Error(`not a summary: ${JSON.stringify(reply)}`);
    return parsed;
  };

  /** Wati: lemper (10.00). Dewi: pesmol (15.00, stall stock). No chef: nasi campur (15.00). */
  async function sellSomething(owner: Person) {
    const dewi = (
      await call('POST', '/api/seller/chefs', { token: owner.token, body: { name: 'Chef Dewi' } })
    ).body as { chef: { id: string } };
    await call('PATCH', '/api/seller/menu/items/pesmol', {
      token: owner.token,
      body: { chefId: dewi.chef.id, dayStock: 5 },
    });
    await order([
      { itemId: 'lemper', qty: 2 },
      { itemId: 'pesmol', qty: 1 },
    ]);
    const cancelled = await order([{ itemId: 'nasi-campur', qty: 3 }]);
    await order([{ itemId: 'nasi-campur', qty: 1 }]);
    const code = (cancelled.body as { order: { code: string } }).order.code;
    const gone = await call('POST', `/api/seller/orders/${code}/status`, {
      token: owner.token,
      body: { to: 'cancelled' },
    });
    expect(gone.status).toBe(200);
    for (const qty of [2, 1]) {
      const sale = await call('POST', '/api/seller/day/sale', {
        token: owner.token,
        body: { itemId: 'pesmol', qty },
      });
      expect(sale.status).toBe(200);
      // The one-portion sale is undone: it must not count.
      if (qty === 1) {
        const entryId = (sale.body as { entryId: string }).entryId;
        await call('POST', '/api/seller/day/undo', { token: owner.token, body: { entryId } });
      }
    }
    return dewi.chef.id;
  }

  it('the owner sees every chef with portions and income; cancelled out, stall sales in, undone out', async () => {
    const { owner } = await people();
    const dewiId = await sellSomething(owner);
    const got = summary(await get(owner));
    expect(got.rows).toEqual([
      {
        chefId: dewiId,
        name: 'Chef Dewi',
        portions: 3,
        preOrderCents: 1500,
        stallCents: 3000,
        incomeCents: 4500,
      },
      {
        chefId: 'wati',
        name: 'Chef Wati',
        portions: 2,
        preOrderCents: 2000,
        stallCents: 0,
        incomeCents: 2000,
      },
      { chefId: null, portions: 1, preOrderCents: 1500, stallCents: 0, incomeCents: 1500 },
    ]);
    expect(got.totalPortions).toBe(6);
    expect(got.totalCents).toBe(8000);
    // The same answer by the menu's own id.
    expect(summary(await get(owner, got.menuId)).rows).toEqual(got.rows);
    // An unknown or older menu: no figures kept.
    expect((await get(owner, 'some-old-menu')).status).toBe(404);
  });

  it('a chef sees only her own line while the setting is on, and 403 once the owner turns it off', async () => {
    const { owner, chef } = await people();
    await sellSomething(owner);
    const own = summary(await get(chef));
    expect(own.rows.map((r) => [r.chefId, r.incomeCents])).toEqual([['wati', 2000]]);
    expect([own.totalPortions, own.totalCents]).toEqual([2, 2000]);
    // The default is on; a chef cannot change it, the owner can.
    const prefs = (c: Person, chefsSeeIncome: boolean) =>
      call('PUT', '/api/seller/preferences', { token: c.token, body: { chefsSeeIncome } });
    expect(
      (
        (await call('GET', '/api/seller/preferences', { token: chef.token })).body as {
          preferences: { chefsSeeIncome: boolean };
        }
      ).preferences.chefsSeeIncome,
    ).toBe(true);
    expect((await prefs(chef, false)).status).toBe(403);
    expect((await prefs(owner, false)).status).toBe(200);
    expect((await get(chef)).status).toBe(403);
    expect(summary(await get(owner)).rows).toHaveLength(3);
    expect((await prefs(owner, true)).status).toBe(200);
    expect((await get(chef)).status).toBe(200);
  });

  it('a helper never gets the figures, whatever the setting', async () => {
    const { owner, helper } = await people();
    await sellSomething(owner);
    expect((await get(helper)).status).toBe(403);
    expect((await get(helper, 'whatever')).status).toBe(403);
  });

  it('answers in one database round trip', async () => {
    const { owner } = await people();
    await sellSomething(owner);
    world.queries.reset();
    expect((await call('GET', '/api/seller/chefs', { token: owner.token })).status).toBe(200);
    const baseline = world.queries.count();
    world.queries.reset();
    expect((await get(owner)).status).toBe(200);
    // The same sign-in work as any seller route, plus exactly one batch for the figures.
    expect(world.queries.count()).toBeLessThanOrEqual(baseline + 1);
  });

  // ---- Stage 3: a finished menu keeps its figures ----
  const finish = (who: Person) =>
    call('POST', '/api/seller/menus/current/finish', { token: who.token });
  const nextMenu = async (who: Person) => {
    expect((await call('POST', '/api/seller/menus', { token: who.token, body: {} })).status).toBe(
      201,
    );
  };
  const currentId = async (who: Person) => summary(await get(who)).menuId;

  it('finishing keeps the rows; after the next menu starts the past menu still answers from them', async () => {
    const { owner } = await people();
    await sellSomething(owner);
    const before = summary(await get(owner));
    world.queries.reset();
    expect((await finish(owner)).status).toBe(200);
    expect(world.queries.count()).toBeLessThanOrEqual(10);
    await nextMenu(owner);
    // The new menu has nothing of the old dishes' chefs; the old one still answers by its id.
    const old = summary(await get(owner, before.menuId));
    expect(old.rows).toEqual(before.rows);
    expect([old.totalPortions, old.totalCents]).toEqual([6, 8000]);
    expect(old.cookingDate).toBe(before.cookingDate);
    expect(summary(await get(owner)).menuId).not.toBe(before.menuId);
  });

  it('a chef sees only her own line of a past menu, and 403 when the setting is off; a helper never', async () => {
    const { owner, chef, helper } = await people();
    await sellSomething(owner);
    const id = await currentId(owner);
    await finish(owner);
    await nextMenu(owner);
    const own = summary(await get(chef, id));
    expect(own.rows.map((r) => [r.chefId, r.incomeCents])).toEqual([['wati', 2000]]);
    expect(own.totalCents).toBe(2000);
    expect((await get(helper, id)).status).toBe(403);
    await call('PUT', '/api/seller/preferences', {
      token: owner.token,
      body: { chefsSeeIncome: false },
    });
    expect((await get(chef, id)).status).toBe(403);
    expect(summary(await get(owner, id)).rows).toHaveLength(3);
  });

  it('a menu finished before the snapshot existed answers "not kept"', async () => {
    const { owner } = await people();
    await sellSomething(owner);
    const id = await currentId(owner);
    await finish(owner);
    await nextMenu(owner);
    await world.db.d1.prepare('UPDATE past_weeks SET chef_summary = NULL').run();
    expect((await get(owner, id)).status).toBe(404);
  });

  it('the hourly auto-finish also keeps the rows', async () => {
    const { owner } = await people();
    await sellSomething(owner);
    const before = summary(await get(owner));
    const counts = await runAutoFinish(
      { DB: world.db.d1 },
      new Date('2026-12-31T13:00:30Z'),
      () => undefined,
    );
    expect(counts.menus).toBeGreaterThanOrEqual(1);
    await nextMenu(owner);
    expect(summary(await get(owner, before.menuId)).rows).toEqual(before.rows);
  });
});
