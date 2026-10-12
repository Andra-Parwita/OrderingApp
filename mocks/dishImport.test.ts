// @vitest-environment node
// Plan 050, stage 2: the dish import preview and apply, and who may do it.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { MAX_DISHES } from '../shared/limits';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('dish CSV import (plan 050)', () => {
  const create = useWorld('dishimport');
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

  const row = (nameEn: string, chef = '', extra: Record<string, unknown> = {}) => ({
    nameEn,
    nameId: nameEn,
    descriptionEn: '',
    descriptionId: '',
    size: '',
    priceCents: 5000,
    chef,
    preorder: true,
    ...extra,
  });

  /** The owner, chef Wati signed in, a helper, and a second chef (Budi). */
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
    const chefs = (
      (await call('GET', '/api/seller/chefs', { token: owner.token })).body as {
        chefs: Array<{ id: string; name: string }>;
      }
    ).chefs;
    const watiName = chefs.find((c) => c.id === 'wati')?.name ?? '';
    await call('POST', '/api/seller/chefs', { token: owner.token, body: { name: 'Budi' } });
    return { owner, wati, helper, watiName };
  }

  type Result = {
    applied: boolean;
    overLimit: boolean;
    counts: { new: number; update: number; error: number };
    rows: Array<{ status: string; name: string; dishId?: string; problem?: { code: string } }>;
  };
  const result = (reply: Reply) => reply.body as Result;
  const dishes = async (token: string) =>
    (
      (await call('GET', '/api/seller/dishes', { token })).body as {
        dishes: Array<{ id: string; name: { en: string }; priceCents: number; chefId?: string }>;
      }
    ).dishes;
  const importRows = (token: string, rows: Array<unknown>, apply: boolean) =>
    call('POST', '/api/seller/dishes/import', { token, body: { rows, apply } });

  it('imports a row with only an Indonesian name and refuses a row with no name', async () => {
    const { owner } = await setup();
    const rows = [row('', '', { nameId: 'Lemper' }), row('', '', { nameId: '' })];
    const reply = result(await importRows(owner.token, rows, true));
    expect(reply.rows.map((r) => r.status)).toEqual(['new', 'error']);
    expect(reply.rows[1]?.problem?.code).toBe('name_required');
    const saved = (await dishes(owner.token)).find((d) => d.name.en === 'Lemper');
    expect(saved).toBeDefined();
    const again = result(await importRows(owner.token, [row('', '', { nameId: 'lemper' })], false));
    expect(again.rows[0]?.status).toBe('update');
  });

  it('previews new, update and error rows without writing; apply writes them', async () => {
    const { owner, watiName } = await setup();
    await call('POST', '/api/seller/dishes', {
      token: owner.token,
      body: { name: { en: 'Soto', id: 'Soto' }, priceCents: 1000 },
    });
    const before = (await dishes(owner.token)).length;
    const rows = [
      row('soto', '', { priceCents: 2500 }),
      row('Lumpia', watiName),
      row('Bad', 'Nobody'),
      row('Tea', '', { preorder: false }),
    ];
    const preview = await importRows(owner.token, rows, false);
    expect(preview.status).toBe(200);
    expect(result(preview).counts).toEqual({ new: 1, update: 1, error: 2 });
    expect(result(preview).rows.map((r) => r.status)).toEqual(['update', 'new', 'error', 'error']);
    expect(result(preview).rows[2]?.problem?.code).toBe('unknown_chef');
    expect(result(preview).rows[3]?.problem?.code).toBe('preorder_needs_stock');
    expect((await dishes(owner.token)).length).toBe(before);

    const applied = await importRows(owner.token, rows, true);
    expect(result(applied).applied).toBe(true);
    const after = await dishes(owner.token);
    expect(after.length).toBe(before + 1);
    expect(after.find((d) => d.name.en === 'soto')?.priceCents).toBe(2500);
    expect(after.find((d) => d.name.en === 'Lumpia')?.chefId).toBe('wati');
  });

  it('matches by name and cook together: the same name for two cooks is two dishes', async () => {
    const { owner, watiName } = await setup();
    const rows = [row('Rendang'), row('Rendang', watiName)];
    await importRows(owner.token, rows, true);
    expect((await dishes(owner.token)).filter((d) => d.name.en === 'Rendang')).toHaveLength(2);
    // Again: each row updates its own dish and none is added.
    const again = result(
      await importRows(
        owner.token,
        rows.map((r) => ({ ...r, priceCents: 9000 })),
        true,
      ),
    );
    expect(again.counts).toEqual({ new: 0, update: 2, error: 0 });
    const list = (await dishes(owner.token)).filter((d) => d.name.en === 'Rendang');
    expect(list).toHaveLength(2);
    expect(list.every((d) => d.priceCents === 9000)).toBe(true);
    // The same name and cook twice in one file is a problem.
    const twice = result(await importRows(owner.token, [row('Rendang'), row('rendang')], false));
    expect(twice.rows[1]?.problem?.code).toBe('duplicate');
  });

  it('a name and cook that match more than one dish is an error', async () => {
    const { owner } = await setup();
    for (let i = 0; i < 2; i += 1) {
      await call('POST', '/api/seller/dishes', {
        token: owner.token,
        body: { name: { en: 'Twin', id: 'Twin' }, priceCents: 1000 },
      });
    }
    const out = result(await importRows(owner.token, [row('Twin')], true));
    expect(out.rows[0]?.problem?.code).toBe('ambiguous');
    expect(out.counts.error).toBe(1);
  });

  it('a chef imports only their own dishes; helpers get 403', async () => {
    const { owner, wati, helper, watiName } = await setup();
    const out = result(
      await importRows(
        wati.token,
        [row('Mine', watiName), row('Empty'), row('Theirs', 'Budi')],
        true,
      ),
    );
    expect(out.rows.map((r) => r.status)).toEqual(['new', 'new', 'error']);
    expect(out.rows[2]?.problem?.code).toBe('not_yours');
    const all = await dishes(owner.token);
    expect(all.find((d) => d.name.en === 'Empty')?.chefId).toBe('wati');
    expect(all.some((d) => d.name.en === 'Theirs')).toBe(false);
    // A kitchen-wide dish of the same name is not the chef's: theirs is a new dish.
    await call('POST', '/api/seller/dishes', {
      token: owner.token,
      body: { name: { en: 'Shared', id: 'Shared' }, priceCents: 1000 },
    });
    const own = result(await importRows(wati.token, [row('Shared', '', { priceCents: 1 })], true));
    expect(own.rows[0]?.status).toBe('new');
    const shared = (await dishes(owner.token)).find((d) => d.name.en === 'Shared' && !d.chefId);
    expect(shared?.priceCents).toBe(1000);
    expect((await importRows(helper.token, [row('X')], false)).status).toBe(403);
  });

  it('refuses an apply over the library limit, and a bad body', async () => {
    const { owner } = await setup();
    const existing = (await dishes(owner.token)).length;
    const rows = Array.from({ length: MAX_DISHES - existing + 1 }, (_, i) =>
      row(`Dish ${String(i)}`),
    );
    expect(result(await importRows(owner.token, rows, false)).overLimit).toBe(true);
    const refused = await importRows(owner.token, rows, true);
    expect(refused.status).toBe(409);
    expect((await dishes(owner.token)).length).toBe(existing);
    const bad = await call('POST', '/api/seller/dishes/import', {
      token: owner.token,
      body: { rows: 'x', apply: true },
    });
    expect(bad.status).toBe(400);
  });
});
