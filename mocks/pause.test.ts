// @vitest-environment node
// Plan 032, stage 3: pausing a kitchen on the server (D-086). `full` signs everyone out and refuses
// sign-in, keys and codes; `customers` lets staff work; both close the customer menu and ordering
// but an existing order still opens; resume restores all; only the admin can pause.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseMeResponse } from '../shared/authContract';
import { parseMenuResponse } from '../shared/menuContract';
import { DEV_ADMIN_SETUP_KEY, devApi, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const SLUG = 'onde-onde';
const ID = 'seller-onde-onde';
const PASSWORD = 'correct horse battery';

describe('pausing a kitchen (plan 032)', () => {
  const create = useWorld('pause');
  let world: World;
  let n = 0;
  const authenticator = new SoftAuthenticator(SITE);

  async function call(method: string, path: string, token?: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers['Cookie'] = `__Host-session=${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`${SITE}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const text = (await response?.text()) ?? '';
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // not JSON
    }
    const cookie = response?.headers.get('set-cookie') ?? '';
    return {
      status: response?.status ?? -1,
      body: parsed,
      token: /__Host-session=([^;]+)/.exec(cookie)?.[1] ?? '',
    };
  }
  const errorOf = (reply: { body: unknown }) => (reply.body as { error?: string }).error;

  async function adminToken(): Promise<string> {
    const setup = await call('POST', '/api/admin/setup', undefined, {
      setupKey: DEV_ADMIN_SETUP_KEY,
      deviceId: 'device-aaaa-0001',
    });
    const asked = await call('POST', '/api/auth/register/options', setup.token);
    const options = (asked.body as { options: Record<string, unknown> }).options;
    const done = await call('POST', '/api/auth/register', setup.token, {
      kind: 'passkey',
      deviceName: 'Laptop',
      response: authenticator.create(options as never),
    });
    expect(done.status).toBe(201);
    return done.token;
  }

  async function inviteKey(admin: string): Promise<string> {
    const invite = await call('POST', `/api/admin/sellers/${ID}/invite-key`, admin, {});
    return (invite.body as { key: string }).key;
  }

  async function ownerToken(admin: string): Promise<string> {
    const setup = await call('POST', '/api/auth/invite', undefined, {
      key: await inviteKey(admin),
      deviceId: 'device-bbbb-0002',
    });
    const full = await call('POST', '/api/auth/register', setup.token, {
      kind: 'password',
      password: PASSWORD,
      deviceName: 'Kitchen phone',
    });
    return full.token;
  }

  const order = () =>
    call('POST', `/api/s/${SLUG}/orders`, undefined, {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
  const pause = (admin: string, kind: string) =>
    call('POST', `/api/admin/sellers/${ID}/pause`, admin, { kind });
  const resume = (admin: string) => call('POST', `/api/admin/sellers/${ID}/resume`, admin);
  async function passwordSignIn() {
    const names = (await call('GET', `/api/s/${SLUG}/team-names`)).body as {
      names: Array<{ accountId: string }>;
    };
    return call('POST', '/api/auth/password', undefined, {
      slug: SLUG,
      accountId: names.names[0]?.accountId,
      password: PASSWORD,
      deviceName: 'Another phone',
      deviceId: 'device-cccc-0003',
    });
  }

  beforeEach(async () => {
    authenticator.credentials.length = 0;
    n = 0;
    world = await create({
      now: () => new Date('2026-10-07T10:00:00Z'),
      newToken: () => `token-${String((n += 1))}`,
    });
  });

  it('full pause signs everyone out, refuses sign-in, keys and codes, and closes customers; resume restores all', async () => {
    const admin = await adminToken();
    const owner = await ownerToken(admin);
    const placed = await order();
    expect(placed.status).toBe(201);
    const token = (placed.body as { order: { token: string } }).order.token;
    const code = (await call('POST', '/api/auth/device-codes', owner)).body as { code: string };
    const spare = await inviteKey(admin);

    const reply = await pause(admin, 'full');
    expect(reply.status).toBe(200);
    expect((reply.body as { seller: { paused?: string } }).seller.paused).toBe('full');

    expect((await call('GET', '/api/seller/orders', owner)).status).toBe(401);
    const signIn = await passwordSignIn();
    expect([signIn.status, errorOf(signIn)]).toEqual([403, 'kitchen_paused']);
    const byKey = await call('POST', '/api/auth/invite', undefined, {
      key: spare,
      deviceId: 'device-eeee-0005',
    });
    expect([byKey.status, errorOf(byKey)]).toEqual([403, 'kitchen_paused']);
    const byCode = await call('POST', '/api/auth/code', undefined, {
      code: code.code,
      deviceId: 'device-ffff-0006',
    });
    expect([byCode.status, errorOf(byCode)]).toEqual([403, 'kitchen_paused']);

    const menu = parseMenuResponse((await call('GET', `/api/s/${SLUG}/menu`)).body);
    expect(menu?.ordering).toEqual({ open: false, reason: 'kitchen_closed' });
    const refused = await order();
    expect([refused.status, errorOf(refused)]).toEqual([409, 'kitchen_closed']);
    expect((await call('GET', `/api/orders?tokens=${token}`)).status).toBe(200);

    expect((await resume(admin)).status).toBe(200);
    expect((await passwordSignIn()).status).toBe(200);
    expect((await order()).status).toBe(201);
  });

  it('customers only: staff work as normal and see the pause; customers cannot order', async () => {
    const admin = await adminToken();
    const owner = await ownerToken(admin);
    expect((await pause(admin, 'customers')).status).toBe(200);
    expect((await call('GET', '/api/seller/orders', owner)).status).toBe(200);
    const me = parseMeResponse((await call('GET', '/api/auth/me', owner)).body);
    expect(me?.me.paused).toBe('customers');
    expect((await passwordSignIn()).status).toBe(200);
    const refused = await order();
    expect([refused.status, errorOf(refused)]).toEqual([409, 'kitchen_closed']);
    expect((await resume(admin)).status).toBe(200);
    expect((await order()).status).toBe(201);
    const after = parseMeResponse((await call('GET', '/api/auth/me', owner)).body);
    expect(after?.me.paused).toBeUndefined();
  });

  it('only an admin can pause or resume', async () => {
    const admin = await adminToken();
    const owner = await ownerToken(admin);
    for (const reply of [
      await call('POST', `/api/admin/sellers/${ID}/pause`, owner, { kind: 'full' }),
      await call('POST', `/api/admin/sellers/${ID}/resume`, owner),
      await call('POST', `/api/admin/sellers/${ID}/pause`, undefined, { kind: 'full' }),
    ]) {
      expect([401, 403]).toContain(reply.status);
    }
    expect((await pause(admin, 'bogus')).status).toBe(400);
    expect((await call('GET', '/api/seller/orders', owner)).status).toBe(200);
  });

  it('the admin list says how each kitchen is paused', async () => {
    const admin = await adminToken();
    await pause(admin, 'customers');
    const list = (await call('GET', '/api/admin/sellers', admin)).body as {
      sellers: Array<{ id: string; paused?: string }>;
    };
    expect(list.sellers.find((row) => row.id === ID)?.paused).toBe('customers');
  });
});
