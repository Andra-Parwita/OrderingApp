// @vitest-environment node
// Stage 7.1: roles, sessions, admin, invite keys, devices, lockout and chef permissions (D-011,
// D-013, D-027 row 1, D-036, D-045); stage 8.2: real WebAuthn passkeys (a software authenticator,
// mocks/softAuthenticator.ts), cookie sessions and the request limiter. Everything runs on an
// injected clock, against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { APP_NAME } from '../shared/appName';
import { parseApiError } from '../shared/apiError';
import {
  parseChefAccessResponse,
  parseCodeResponse,
  parseDevicesResponse,
  parseKeyResponse,
  parseMeResponse,
  parseSellerResponse,
  parseSellersResponse,
  parseInvitesResponse,
  parseMembersResponse,
  parseMembershipsResponse,
  parseSessionResponse,
  parseTeamNamesResponse,
  type SessionResponse,
} from '../shared/authContract';
import { parseLogListResponse } from '../shared/logContract';
import { parseSellerOrderResponse, parseSellerOrdersResponse } from '../shared/orderContract';

import { DEV_ADMIN_SETUP_KEY, devApi, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

/** A sign-in answer plus the session token read out of its `Set-Cookie` header. */
type Login = SessionResponse & { token: string };
const SITE = 'https://delave.test';

const A = 'onde-onde';
const B = 'dapur-demo';
const A_ID = 'seller-onde-onde';
const B_ID = 'seller-dapur-demo';
const START = Date.parse('2026-10-07T10:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const DEVICE = 'device-aaaa-0001';
const DEVICE_2 = 'device-bbbb-0002';

describe('sign-in', () => {
  const create = useWorld('auth');
  let world: World;
  let nowMs: number;
  let tokenCounter = 0;

  type Reply = { status: number; body: unknown; setCookie: string | null };

  async function call(
    method: string,
    path: string,
    options: {
      token?: string;
      body?: unknown;
      headers?: Record<string, string>;
      /** The host of the request URL; passkeys depend on it. */
      host?: string;
    } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://${options.host ?? 'delave.test'}${path}`, {
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
      return { status: response.status, body: text, setCookie }; // e.g. the orders CSV
    }
  }

  const errorOf = (reply: Reply) => parseApiError(reply.body);

  function session(reply: Reply): Login {
    const parsed = parseSessionResponse(reply.body);
    if (!parsed) throw new Error(`not a session: ${JSON.stringify(reply)}`);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!token) throw new Error(`no session cookie: ${JSON.stringify(reply)}`);
    return { ...parsed, token };
  }

  /** The software passkeys of this test, by the site they work on. */
  const authenticator = new SoftAuthenticator(SITE);

  /** Setup session → registration options → software authenticator → verified registration. */
  async function registerPasskey(
    token: string,
    deviceName: string,
    soft: SoftAuthenticator = authenticator,
  ): Promise<Login> {
    const asked = await call('POST', '/api/auth/register/options', { token });
    const options = (asked.body as { options?: Record<string, unknown> }).options;
    if (asked.status !== 200 || !options) throw new Error(`no options: ${JSON.stringify(asked)}`);
    const response = soft.create(options as never);
    return session(
      await call('POST', '/api/auth/register', {
        token,
        body: { kind: 'passkey', deviceName, response },
      }),
    );
  }

  /** Options → software authenticator → the sign-in call (the reply, not yet a session). */
  async function passkeySignIn(
    soft: SoftAuthenticator,
    deviceId: string,
    extra: { origin?: string; counter?: number; breakSignature?: boolean } = {},
    credentialId: string | undefined = soft.credentials.length > 0 ? soft.lastId : undefined,
  ): Promise<Reply> {
    const asked = await call('POST', '/api/auth/passkey/options', {
      body: { deviceId, ...(credentialId ? { credentialId } : {}) },
    });
    const options = (asked.body as { options?: Record<string, unknown> }).options;
    if (asked.status !== 200 || !options) return asked;
    return call('POST', '/api/auth/passkey', {
      body: { deviceId, response: soft.get(options as never, extra) },
    });
  }

  function key(reply: Reply) {
    const parsed = parseKeyResponse(reply.body);
    if (!parsed) throw new Error(`not a key: ${JSON.stringify(reply)}`);
    return parsed;
  }

  let adminLogin: Login | undefined;

  /** Admin set up with a real (software) passkey, once per test; returns the full session. */
  async function adminSignedIn(): Promise<Login> {
    if (adminLogin) return adminLogin;
    const setup = session(
      await call('POST', '/api/admin/setup', {
        body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
      }),
    );
    adminLogin = await registerPasskey(setup.token, 'Owner laptop');
    return adminLogin;
  }

  /** A seller (by id) with an invite key redeemed and a password set. */
  async function sellerSignedIn(sellerId: string, password = 'correct horse battery') {
    const admin = await adminSignedIn();
    const invite = key(await call('POST', `/api/admin/sellers/${sellerId}/invite-key`, admin));
    const setup = session(
      await call('POST', '/api/auth/invite', { body: { key: invite.key, deviceId: DEVICE_2 } }),
    );
    const full = session(
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password, deviceName: 'Kitchen phone' },
      }),
    );
    return { admin, invite, full };
  }

  /** The account id of a kitchen person who has a password, picked by name (the sign-in picker). */
  async function personId(slug: string, displayName: string): Promise<string> {
    const reply = await call('GET', `/api/s/${slug}/team-names`);
    const found = parseTeamNamesResponse(reply.body)?.names.find(
      (name) => name.displayName === displayName,
    );
    if (!found) throw new Error(`no ${displayName} in ${slug}: ${JSON.stringify(reply.body)}`);
    return found.accountId;
  }

  /** The kitchen's name is the owner's starting name when the admin sends none. */
  const OWNER_A = 'Onde Onde';

  const newToken = () => `token-${String(++tokenCounter)}`;

  beforeEach(async () => {
    tokenCounter = 0;
    adminLogin = undefined;
    authenticator.credentials.length = 0;
    nowMs = START;
    world = await create({ now: () => new Date(nowMs), newToken });
  });

  describe('admin setup', () => {
    it('registers the first admin with the dev key, then refuses a second setup', async () => {
      const admin = await adminSignedIn();
      expect(admin.me).toMatchObject({ role: 'admin', stage: 'full', deviceName: 'Owner laptop' });
      expect(admin.credentialId).toBeTruthy();
      const again = await call('POST', '/api/admin/setup', {
        body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE_2 },
      });
      expect(again.status).toBe(409);
      expect(errorOf(again)?.error).toBe('admin_exists');
    });

    it('refuses a wrong setup key with the plain error and counts it', async () => {
      const reply = await call('POST', '/api/admin/setup', {
        body: { setupKey: 'DLV-NOPE-NOPE-NOPE-NOPE', deviceId: DEVICE },
      });
      expect(reply.status).toBe(401);
      expect(errorOf(reply)).toMatchObject({ error: 'invalid_credentials', triesLeft: 4 });
    });

    it('lets setup be repeated while no admin device was registered', async () => {
      const first = await call('POST', '/api/admin/setup', {
        body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
      });
      expect(first.status).toBe(200);
      const second = await call('POST', '/api/admin/setup', {
        body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
      });
      expect(second.status).toBe(200);
    });

    it('signs the admin in again with the passkey, and refuses an unknown credential', async () => {
      const admin = await adminSignedIn();
      await call('POST', '/api/auth/sign-out', { token: admin.token });
      expect((await call('GET', '/api/auth/me', { token: admin.token })).status).toBe(401);
      const back = session(await passkeySignIn(authenticator, DEVICE));
      expect(back.me.role).toBe('admin');
      expect(back.credentialId).toBe(authenticator.lastId);
      const stranger = new SoftAuthenticator(SITE);
      stranger.create({ challenge: 'x' });
      const bad = await passkeySignIn(stranger, DEVICE);
      expect(errorOf(bad)?.error).toBe('invalid_credentials');
    });

    it('gives the admin no password option', async () => {
      const setup = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
        }),
      );
      const reply = await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password: 'long enough password', deviceName: 'Laptop' },
      });
      expect(reply.status).toBe(400);
    });
  });

  describe('admin: client log (plan 026)', () => {
    const logged = (message: string) => ({
      app: 'customer' as const,
      version: 'dev',
      slug: null,
      path: '/',
      kind: 'js_error' as const,
      code: 'TypeError',
      message,
      agent: 'Safari iOS 17',
      standalone: false,
    });

    it('refuses anonymous callers and sellers', async () => {
      expect((await call('GET', '/api/admin/log')).status).toBe(401);
      const { full } = await sellerSignedIn(A_ID);
      expect((await call('GET', '/api/admin/log', { token: full.token })).status).toBe(403);
    });

    it('gives the admin the newest entries first', async () => {
      const admin = await adminSignedIn();
      await world.repo.log.record([logged('older')]);
      await world.repo.log.record([logged('newer')]);
      const reply = await call('GET', '/api/admin/log', admin);
      expect(reply.status).toBe(200);
      const parsed = parseLogListResponse(reply.body);
      expect(parsed?.entries.map((e) => e.message)).toEqual(['newer', 'older']);
      expect(parsed?.total).toBe(2);
    });

    it('filters by app and kitchen, pages 50 at a time, and clears (admin only)', async () => {
      const admin = await adminSignedIn();
      const { full } = await sellerSignedIn(A_ID);
      for (let n = 1; n <= 55; n += 1) await world.repo.log.record([logged(`c${String(n)}`)]);
      await world.repo.log.record([{ ...logged('s1'), app: 'seller', slug: 'onde-onde' }]);
      const get = async (query: string) =>
        parseLogListResponse((await call('GET', `/api/admin/log${query}`, admin)).body);
      const first = await get('');
      expect([first?.entries.length, first?.total]).toEqual([50, 56]);
      const second = await get('?offset=50');
      expect(second?.entries.map((e) => e.message)).toEqual(['c6', 'c5', 'c4', 'c3', 'c2', 'c1']);
      expect((await get('?app=seller'))?.entries.map((e) => e.message)).toEqual(['s1']);
      const kitchen = await get('?slug=onde-onde');
      expect([kitchen?.total, kitchen?.entries[0]?.message]).toEqual([1, 's1']);
      expect((await get('?app=admin'))?.total).toBe(0);
      // A bad filter or offset is ignored.
      expect((await get('?app=nope&offset=-3'))?.entries).toHaveLength(50);

      expect((await call('DELETE', '/api/admin/log')).status).toBe(401);
      expect((await call('DELETE', '/api/admin/log', { token: full.token })).status).toBe(403);
      expect((await get(''))?.total).toBe(56);
      expect((await call('DELETE', '/api/admin/log', admin)).status).toBe(200);
      expect((await get(''))?.total).toBe(0);
    });
  });

  describe('admin: sellers', () => {
    it('answers a newly added seller with its summary line', async () => {
      const admin = await adminSignedIn();
      const reply = await call('POST', '/api/admin/sellers', {
        ...admin,
        body: { name: 'Warung Baru', slug: 'warung-baru' },
      });
      expect(reply.status).toBe(201);
      expect(parseSellerResponse(reply.body)?.seller.summary).toMatchObject({
        people: 0,
        orders: 0,
      });
    });

    it('lists and creates sellers with slug rules, unique slugs and an empty kitchen', async () => {
      const admin = await adminSignedIn();
      const listed = parseSellersResponse((await call('GET', '/api/admin/sellers', admin)).body);
      expect(listed?.sellers.map((seller) => seller.slug)).toEqual([A, B]);
      // The fixed sellers have fixed dates; a new one gets the clock time of its creation.
      expect(listed?.sellers.map((seller) => seller.createdAt)).toEqual([
        '2026-08-15T09:00:00.000Z',
        '2026-09-20T09:00:00.000Z',
      ]);

      const created = await call('POST', '/api/admin/sellers', {
        ...admin,
        body: { name: 'Warung Baru', slug: 'warung-baru' },
      });
      expect(created.status).toBe(201);
      const seller = parseSellerResponse(created.body)?.seller;
      expect(seller).toMatchObject({
        name: 'Warung Baru',
        slug: 'warung-baru',
        createdAt: new Date(START).toISOString(),
      });
      const after = parseSellersResponse((await call('GET', '/api/admin/sellers', admin)).body);
      expect(after?.sellers[2]?.createdAt).toBe(new Date(START).toISOString());
      // The customer menu does not carry it.
      expect(JSON.stringify((await call('GET', '/api/s/warung-baru/menu')).body)).not.toContain(
        'createdAt',
      );

      for (const slug of ['Warung', 'a', 'admin', 'has space', '-x-', 'dapur-demo']) {
        const reply = await call('POST', '/api/admin/sellers', {
          ...admin,
          body: { name: 'X', slug },
        });
        expect(reply.status, slug).toBe(slug === 'dapur-demo' ? 409 : 400);
      }
      expect(
        errorOf(
          await call('POST', '/api/admin/sellers', { ...admin, body: { name: 'X', slug: B } }),
        )?.error,
      ).toBe('slug_taken');

      const menu = await call('GET', '/api/s/warung-baru/menu');
      expect(menu.status).toBe(200);
      expect((menu.body as { items: Array<unknown> }).items).toEqual([]);
      // A reset forgets sellers the admin added.
      await world.reset();
      expect((await call('GET', '/api/s/warung-baru/menu')).status).toBe(404);
    });

    it('keeps every admin endpoint away from seller sessions and anonymous callers', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const routes: Array<[string, string]> = [
        ['GET', '/api/admin/sellers'],
        ['POST', '/api/admin/sellers'],
        ['POST', `/api/admin/sellers/${A_ID}/invite-key`],
        ['POST', `/api/admin/sellers/${A_ID}/recovery-key`],
        ['GET', `/api/admin/sellers/${A_ID}/devices`],
        ['GET', `/api/admin/sellers/${A_ID}/invites`],
        ['GET', `/api/admin/sellers/${A_ID}/chefs`],
        ['POST', `/api/admin/sellers/${A_ID}/chefs/wati/sign-out-all`],
      ];
      for (const [method, path] of routes) {
        const body = method === 'POST' ? { name: 'X', slug: 'xx' } : undefined;
        const anon = await call(method, path, { body });
        expect(anon.status, `${method} ${path}`).toBe(401);
        const seller = await call(method, path, {
          token: full.token,
          body,
        });
        expect(seller.status, `${method} ${path}`).toBe(403);
        expect(errorOf(seller)?.error).toBe('forbidden');
      }
    });

    it("shows the admin a seller's devices and signs one out", async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      const list = parseDevicesResponse(
        (await call('GET', `/api/admin/sellers/${A_ID}/devices`, admin)).body,
      );
      expect(list?.devices).toHaveLength(1);
      expect(list?.devices[0]).toMatchObject({ name: 'Kitchen phone', role: 'seller' });
      const id = list?.devices[0]?.id ?? '';
      expect((await call('DELETE', `/api/admin/sellers/${A_ID}/devices/${id}`, admin)).status).toBe(
        200,
      );
      expect((await call('GET', '/api/auth/me', { token: full.token })).status).toBe(401);
      // Another seller's device id is not reachable through this seller.
      expect((await call('DELETE', `/api/admin/sellers/${B_ID}/devices/${id}`, admin)).status).toBe(
        404,
      );
    });

    it("lists the admin's own devices", async () => {
      const admin = await adminSignedIn();
      const own = parseDevicesResponse((await call('GET', '/api/auth/devices', admin)).body);
      expect(own?.devices).toEqual([
        expect.objectContaining({ name: 'Owner laptop', role: 'admin', current: true }),
      ]);
    });
  });

  describe('invite keys', () => {
    it('is shown once, stored only as a hash, and lasts 24 hours', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      expect(invite.key).toMatch(/^DLV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(invite.maxDevices).toBe(1);
      expect(Date.parse(invite.expiresAt)).toBe(START + DAY);
      const plain = invite.key.replace(/-/g, '');
      const kept = await world.dumpSecrets();
      expect(kept).not.toContain(invite.key);
      expect(kept).not.toContain(plain.slice(3));
      expect(kept).toMatch(/[0-9a-f]{64}/);

      nowMs = START + DAY - MIN;
      const ok = await call('POST', '/api/auth/invite', {
        body: { key: invite.key, deviceId: DEVICE },
      });
      expect(ok.status).toBe(200);
      expect(session(ok).me).toMatchObject({ role: 'seller', stage: 'setup', slug: A });
    });

    it('accepts the key typed loosely (lowercase, no dashes, no prefix)', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const loose = invite.key.slice(4).replace(/-/g, '').toLowerCase();
      expect(
        (await call('POST', '/api/auth/invite', { body: { key: loose, deviceId: DEVICE } })).status,
      ).toBe(200);
    });

    it('expires after 24 hours with the same plain error as a wrong key', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      nowMs = START + DAY;
      const expired = await call('POST', '/api/auth/invite', {
        body: { key: invite.key, deviceId: DEVICE },
      });
      const wrong = await call('POST', '/api/auth/invite', {
        body: { key: 'DLV-AAAA-BBBB-CCCC-DDDD', deviceId: DEVICE_2 },
      });
      expect(expired.status).toBe(401);
      expect(errorOf(expired)?.error).toBe('invalid_credentials');
      expect(errorOf(wrong)?.error).toBe('invalid_credentials');
      expect(errorOf(expired)?.message).toBe(errorOf(wrong)?.message);
    });

    it('works once (D-085): one device, then it is spent', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const redeem = (deviceId: string) =>
        call('POST', '/api/auth/invite', { body: { key: invite.key, deviceId } });
      expect((await redeem('phone-0001-aaaa')).status).toBe(200);
      expect((await redeem('phone-0001-aaaa')).status).toBe(401); // same device again
      expect((await redeem('phone-0002-bbbb')).status).toBe(401); // spent
    });

    it('issues a recovery key the same way', async () => {
      const admin = await adminSignedIn();
      const recovery = key(await call('POST', `/api/admin/sellers/${A_ID}/recovery-key`, admin));
      const reply = await call('POST', '/api/auth/invite', {
        body: { key: recovery.key, deviceId: DEVICE },
      });
      expect(session(reply).me.role).toBe('seller');
    });

    it('refuses a key for an unknown seller', async () => {
      const admin = await adminSignedIn();
      const reply = await call('POST', '/api/admin/sellers/nope/invite-key', admin);
      expect(errorOf(reply)?.error).toBe('seller_not_found');
    });

    it('only lets a setup session finish registering', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const setup = session(
        await call('POST', '/api/auth/invite', { body: { key: invite.key, deviceId: DEVICE } }),
      );
      expect((await call('GET', '/api/seller/orders', { token: setup.token })).status).toBe(401);
      expect((await call('GET', '/api/auth/devices', { token: setup.token })).status).toBe(401);
      expect(parseMeResponse((await call('GET', '/api/auth/me', setup)).body)?.me.stage).toBe(
        'setup',
      );
      // A full session cannot register again.
      const full = await registerPasskey(setup.token, 'Phone');
      const twice = await call('POST', '/api/auth/register', {
        token: full.token,
        body: { kind: 'passkey', deviceName: 'Phone', response: { id: 'x' } },
      });
      expect(twice.status).toBe(401);
      // And a setup session expires after an hour.
      const second = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const another = session(
        await call('POST', '/api/auth/invite', { body: { key: second.key, deviceId: DEVICE_2 } }),
      );
      nowMs += 61 * MIN;
      const late = await call('POST', '/api/auth/register', {
        token: another.token,
        body: { kind: 'passkey', deviceName: 'Tablet', response: { id: 'x' } },
      });
      expect(late.status).toBe(401);
    });
  });

  describe('password', () => {
    it('needs 10 characters, is hashed with PBKDF2 and signs in on a new device', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const setup = session(
        await call('POST', '/api/auth/invite', { body: { key: invite.key, deviceId: DEVICE } }),
      );
      const short = await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password: '123456789', deviceName: 'Phone' },
      });
      expect(short.status).toBe(400);
      const password = 'my kitchen secret';
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password, deviceName: 'Phone' },
      });
      const kept = await world.dumpSecrets();
      expect(kept).not.toContain(password);
      expect(kept).toContain('"iterations":100000');

      const accountId = await personId(A, OWNER_A);
      const signIn = await call('POST', '/api/auth/password', {
        body: { slug: A, accountId, password, deviceId: DEVICE_2, deviceName: 'Tablet' },
      });
      expect(session(signIn).me).toMatchObject({
        role: 'seller',
        slug: A,
        displayName: OWNER_A,
        deviceName: 'Tablet',
      });
      const wrong = await call('POST', '/api/auth/password', {
        body: {
          slug: A,
          accountId,
          password: 'not the password',
          deviceId: DEVICE_2,
          deviceName: 'Tablet',
        },
      });
      expect(errorOf(wrong)).toMatchObject({ error: 'invalid_credentials', triesLeft: 4 });
      const unknown = await call('POST', '/api/auth/password', {
        body: { slug: 'nobody', accountId, password, deviceId: DEVICE_2, deviceName: 'Tablet' },
      });
      expect(errorOf(unknown)?.error).toBe('invalid_credentials');
    });
  });

  describe('add-device code', () => {
    it('is 6 digits, valid 10 minutes, one use, and gives a setup session for the same account', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const made = await call('POST', '/api/auth/device-codes', full);
      expect(made.status).toBe(201);
      const code = parseCodeResponse(made.body);
      expect(code?.code).toMatch(/^\d{6}$/);
      expect(Date.parse(code?.expiresAt ?? '')).toBe(START + 10 * MIN);
      expect(await world.dumpSecrets()).not.toContain(`"${code?.code}"`);

      const used = await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'tablet-0001-zzzz' },
      });
      expect(session(used).me).toMatchObject({ role: 'seller', stage: 'setup', slug: A });
      const again = await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'tablet-0001-zzzz' },
      });
      expect(errorOf(again)?.error).toBe('invalid_credentials');
    });

    it('allows 5 wrong codes per kitchen however the device id changes, then the real code is dead', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', full)).body);
      const wrong = code?.code === '000000' ? '000001' : '000000';
      const answers: Array<string | undefined> = [];
      for (let i = 0; i < 5; i++) {
        const reply = await call('POST', '/api/auth/code', {
          body: { code: wrong, deviceId: `rotating-device-${String(i)}` },
        });
        answers.push(errorOf(reply)?.error);
      }
      expect(answers).toEqual([
        'invalid_credentials',
        'invalid_credentials',
        'invalid_credentials',
        'invalid_credentials',
        'locked_out',
      ]);
      const real = await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'rotating-device-fresh' },
      });
      expect(errorOf(real)?.error).toBe('locked_out');
      // Once the lock ends the old code is still gone, and a new one works.
      nowMs = START + 16 * MIN;
      const old = await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'rotating-device-fresh' },
      });
      expect(errorOf(old)?.error).toBe('invalid_credentials');
    });

    it('lets exactly one of two concurrent redemptions of the same code through', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', full)).body);
      const replies = await Promise.all(
        ['racer-0001-aaaa', 'racer-0002-bbbb'].map((deviceId) =>
          call('POST', '/api/auth/code', { body: { code: code?.code, deviceId } }),
        ),
      );
      expect(replies.filter((reply) => reply.status === 200).length).toBe(1);
      const lost = replies.find((reply) => reply.status !== 200);
      expect(lost && errorOf(lost)?.error).toBe('invalid_credentials');
    });

    it('expires after 10 minutes', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', full)).body);
      nowMs = START + 10 * MIN;
      const late = await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'tablet-0001-zzzz' },
      });
      expect(late.status).toBe(401);
    });

    it('needs a signed-in device, and a second device can finish with a passkey', async () => {
      expect((await call('POST', '/api/auth/device-codes')).status).toBe(401);
      const { full } = await sellerSignedIn(A_ID);
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', full)).body);
      const setup = session(
        await call('POST', '/api/auth/code', {
          body: { code: code?.code, deviceId: 'tablet-0001-zzzz' },
        }),
      );
      // The account already has a password, so a second password is refused on an add-device setup.
      const pw = await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password: 'another long password', deviceName: 'Tablet' },
      });
      expect(pw.status).toBe(409);
      expect(errorOf(pw)?.error).toBe('password_exists');
      const passkey = await registerPasskey(setup.token, 'Tablet', new SoftAuthenticator(SITE));
      expect(passkey.me.stage).toBe('full');
      const devices = parseDevicesResponse((await call('GET', '/api/auth/devices', full)).body);
      expect(devices?.devices.map((device) => device.name).sort()).toEqual([
        'Kitchen phone',
        'Tablet',
      ]);
      // Plan 125: each device says how it signs in.
      const how = Object.fromEntries(
        (devices?.devices ?? []).map((device) => [device.name, device.signIn]),
      );
      expect(how).toEqual({ 'Kitchen phone': 'password', Tablet: 'passkey' });
    });
  });

  describe('people of a kitchen (plan 125)', () => {
    it('tells a full session how many people the kitchen has, and the admin who signs in how', async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      const meOf = async (login: Login) =>
        parseMeResponse((await call('GET', '/api/auth/me', login)).body)?.me;
      expect((await meOf(full))?.people).toBe(1);
      // A second person joins by a key and finishes with a password; an unfinished third waits.
      const second = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const setup = session(
        await call('POST', '/api/auth/invite', { body: { key: second.key, deviceId: DEVICE } }),
      );
      expect((await meOf(setup))?.people).toBeUndefined(); // a setup session has no count
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password: 'another long password', deviceName: 'Tablet' },
      });
      const third = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      await call('POST', '/api/auth/invite', {
        body: { key: third.key, deviceId: 'device-cccc-0003' },
      });
      expect((await meOf(full))?.people).toBe(3);

      const members = parseMembersResponse(
        (await call('GET', `/api/admin/sellers/${A_ID}/members`, admin)).body,
      )?.members;
      expect(members?.map((m) => [m.devices, m.passkeys, m.unfinished])).toEqual([
        [1, 0, undefined],
        [1, 0, undefined],
        [0, 0, true],
      ]);
    });
  });

  describe('add a device when the account already has a login (plan 025)', () => {
    const flagsOf = (login: Login) => ({
      hasPassword: login.me.hasPassword,
      hasPasskey: login.me.hasPasskey,
    });
    const codeSetup = async (full: Login, deviceId: string) => {
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', full)).body);
      return session(
        await call('POST', '/api/auth/code', { body: { code: code?.code, deviceId } }),
      );
    };

    it('tells a setup session whether the account has a password and a passkey', async () => {
      const { full } = await sellerSignedIn(A_ID);
      // Password only.
      const viaCode = await codeSetup(full, 'tablet-0001-zzzz');
      expect(flagsOf(viaCode)).toEqual({ hasPassword: true, hasPasskey: false });
      const me = parseMeResponse((await call('GET', '/api/auth/me', viaCode)).body);
      expect(me?.me).toMatchObject({ stage: 'setup', hasPassword: true, hasPasskey: false });
      // Passkey too, after the tablet registers one.
      await registerPasskey(viaCode.token, 'Tablet', new SoftAuthenticator(SITE));
      expect(flagsOf(await codeSetup(full, 'tablet-0002-yyyy'))).toEqual({
        hasPassword: true,
        hasPasskey: true,
      });
      // Passkey only: the admin.
      const admin = await adminSignedIn();
      expect(flagsOf(await codeSetup(admin, 'laptop-0001-xxxx'))).toEqual({
        hasPassword: false,
        hasPasskey: true,
      });
      // Neither: a kitchen that was only invited (the invite key is redeemed, nothing registered).
      const newInvite = key(await call('POST', `/api/admin/sellers/${B_ID}/invite-key`, admin));
      const bare = session(
        await call('POST', '/api/auth/invite', {
          body: { key: newInvite.key, deviceId: 'bare-0001-wwww' },
        }),
      );
      expect(flagsOf(bare)).toEqual({ hasPassword: false, hasPasskey: false });
    });

    it('a full session carries no flags', async () => {
      const { full } = await sellerSignedIn(A_ID);
      expect(flagsOf(full)).toEqual({ hasPassword: undefined, hasPasskey: undefined });
    });

    it('signs in with the existing passkey after a code, and only with a real check', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const soft = new SoftAuthenticator(SITE);
      await registerPasskey((await codeSetup(full, 'tablet-0001-zzzz')).token, 'Tablet', soft);
      const setup = await codeSetup(full, 'tablet-0002-yyyy');
      // The setup session alone is not a full session.
      expect((await call('GET', '/api/seller/orders', setup)).status).toBe(401);
      // A broken signature does not turn it into one, and counts as a failed try.
      const forged = await passkeySignIn(soft, 'tablet-0002-yyyy', { breakSignature: true });
      expect(errorOf(forged)?.error).toBe('invalid_credentials');
      // The real passkey signs in through the normal check.
      const ok = session(await passkeySignIn(soft, 'tablet-0002-yyyy'));
      expect(ok.me.stage).toBe('full');
    });

    it('keeps the code rules: single use', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', full)).body);
      await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'tablet-0001-zzzz' },
      });
      const second = await call('POST', '/api/auth/code', {
        body: { code: code?.code, deviceId: 'tablet-0002-yyyy' },
      });
      expect(errorOf(second)?.error).toBe('invalid_credentials');
    });
  });

  describe('devices', () => {
    it('lists, renames and signs out only the own account devices', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const other = await sellerSignedIn(B_ID);
      const mine = parseDevicesResponse((await call('GET', '/api/auth/devices', full)).body);
      const theirs = parseDevicesResponse(
        (await call('GET', '/api/auth/devices', other.full)).body,
      );
      const myId = mine?.devices[0]?.id ?? '';
      const theirId = theirs?.devices[0]?.id ?? '';
      expect(mine?.devices[0]?.current).toBe(true);

      expect(
        (
          await call('PATCH', `/api/auth/devices/${myId}`, {
            ...full,
            body: { name: 'Shop tablet' },
          })
        ).status,
      ).toBe(200);
      expect(
        (await call('PATCH', `/api/auth/devices/${theirId}`, { ...full, body: { name: 'Hacked' } }))
          .status,
      ).toBe(404);
      expect((await call('DELETE', `/api/auth/devices/${theirId}`, full)).status).toBe(404);
      expect((await call('GET', '/api/auth/me', other.full)).status).toBe(200);

      expect((await call('DELETE', `/api/auth/devices/${myId}`, full)).status).toBe(200);
      expect((await call('GET', '/api/auth/me', full)).status).toBe(401);
    });

    it('signing out ends the session but the passkey device can sign in again', async () => {
      const admin = await adminSignedIn();
      const out = await call('POST', '/api/auth/sign-out', admin);
      expect(out.status).toBe(200);
      expect((await call('GET', '/api/auth/me', admin)).status).toBe(401);
    });
  });

  describe('sessions', () => {
    it('expires after 30 days without use, and is renewed on use', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const first = (await world.expiryOf(full.token)) ?? 0;
      expect(first).toBe(START + 30 * DAY);

      nowMs = START + 20 * DAY;
      expect((await call('GET', '/api/auth/me', full)).status).toBe(200);
      expect(await world.expiryOf(full.token)).toBe(START + 50 * DAY);

      nowMs = START + 49 * DAY; // 29 days after the last use
      expect((await call('GET', '/api/auth/me', full)).status).toBe(200);
      nowMs = START + 49 * DAY + 30 * DAY;
      expect((await call('GET', '/api/auth/me', full)).status).toBe(401);
    });

    it('refuses a made-up token and one with the wrong scheme', async () => {
      expect((await call('GET', '/api/seller/orders', { token: 'nope' })).status).toBe(401);
      // The old Authorization: Bearer scheme is gone: a valid token there is just a stranger.
      const { full } = await sellerSignedIn(A_ID);
      const reply = await call('GET', '/api/seller/orders', {
        headers: { Authorization: `Bearer ${full.token}`, 'X-Seller': A },
      });
      expect(reply.status).toBe(200); // no cookie: the dev X-Seller override, not the session
      expect(
        (await call('GET', '/api/auth/me', { headers: { Authorization: `Bearer ${full.token}` } }))
          .status,
      ).toBe(401);
    });

    it('stamps lastUsedAt on use', async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      nowMs = START + 3 * DAY;
      await call('GET', '/api/seller/orders', full);
      const list = parseDevicesResponse(
        (await call('GET', `/api/admin/sellers/${A_ID}/devices`, admin)).body,
      );
      expect(list?.devices[0]?.lastUsedAt).toBe(new Date(START + 3 * DAY).toISOString());
    });
  });

  describe('passkeys (WebAuthn, stage 8.2)', () => {
    const optionsOf = (reply: Reply) =>
      (reply.body as { options: Record<string, unknown> & { challenge: string } }).options;

    it('needs a setup session for registration options, and describes this site', async () => {
      expect((await call('POST', '/api/auth/register/options')).status).toBe(401);
      const setup = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
        }),
      );
      const asked = await call('POST', '/api/auth/register/options', setup);
      expect(asked.status).toBe(200);
      const options = optionsOf(asked);
      expect(options['rp']).toEqual({ name: APP_NAME, id: 'delave.test' });
      expect(options.challenge.length).toBeGreaterThan(20);
      expect(options['excludeCredentials']).toEqual([]);
      // Once the admin has a passkey, a second setup (add-device) must not offer the same one again.
      const admin = await registerPasskey(setup.token, 'Laptop');
      const code = parseCodeResponse((await call('POST', '/api/auth/device-codes', admin)).body);
      const again = session(
        await call('POST', '/api/auth/code', {
          body: { code: code?.code, deviceId: DEVICE_2 },
        }),
      );
      const second = optionsOf(await call('POST', '/api/auth/register/options', again));
      expect(second['excludeCredentials']).toEqual([
        { id: authenticator.lastId, type: 'public-key', transports: ['internal'] },
      ]);
    });

    it('refuses an answer for the wrong site, a replayed registration and a stranger session', async () => {
      const setup = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
        }),
      );
      const options = optionsOf(await call('POST', '/api/auth/register/options', setup));
      const wrongSite = authenticator.create(options, { origin: 'https://evil.test' });
      const bad = await call('POST', '/api/auth/register', {
        ...setup,
        body: { kind: 'passkey', deviceName: 'Laptop', response: wrongSite },
      });
      expect(bad.status).toBe(400);
      // The challenge was used up by that try, so even a right answer to it is now refused.
      const right = authenticator.create(options);
      const used = await call('POST', '/api/auth/register', {
        ...setup,
        body: { kind: 'passkey', deviceName: 'Laptop', response: right },
      });
      expect(used.status).toBe(400);
      expect((await call('GET', '/api/auth/me', setup)).status).toBe(200); // still only a setup session

      // A fresh challenge works once; the same answer again does not.
      const fresh = optionsOf(await call('POST', '/api/auth/register/options', setup));
      const answer = authenticator.create(fresh);
      const done = await call('POST', '/api/auth/register', {
        ...setup,
        body: { kind: 'passkey', deviceName: 'Laptop', response: answer },
      });
      expect(done.status).toBe(201);
      const replayed = await call('POST', '/api/auth/register', {
        ...setup,
        body: { kind: 'passkey', deviceName: 'Laptop', response: answer },
      });
      expect(replayed.status).toBe(401); // that setup session became a full one
    });

    it("refuses another setup session's challenge", async () => {
      const first = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
        }),
      );
      const second = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE_2 },
        }),
      );
      const options = optionsOf(await call('POST', '/api/auth/register/options', first));
      const stolen = await call('POST', '/api/auth/register', {
        ...second,
        body: {
          kind: 'passkey',
          deviceName: 'Laptop',
          response: authenticator.create(options),
        },
      });
      expect(stolen.status).toBe(400);
    });

    it('expires a registration challenge after 5 minutes', async () => {
      const setup = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
        }),
      );
      const options = optionsOf(await call('POST', '/api/auth/register/options', setup));
      nowMs += 6 * MIN;
      const late = await call('POST', '/api/auth/register', {
        ...setup,
        body: {
          kind: 'passkey',
          deviceName: 'Laptop',
          response: authenticator.create(options),
        },
      });
      expect(late.status).toBe(400);
    });

    it('signs in, and moves the signature counter up each time', async () => {
      const admin = await adminSignedIn();
      await call('POST', '/api/auth/sign-out', admin);
      for (let i = 0; i < 3; i++) {
        const back = await passkeySignIn(authenticator, DEVICE);
        expect(back.status).toBe(200);
        expect(session(back).me.role).toBe('admin');
      }
    });

    it('refuses a replayed answer, a counter that went back, a wrong site and a bad signature', async () => {
      await adminSignedIn();
      await passkeySignIn(authenticator, DEVICE); // counter 1
      await passkeySignIn(authenticator, DEVICE); // counter 2

      // Replay: the very same answer sent twice (the challenge is single use).
      const asked = optionsOf(
        await call('POST', '/api/auth/passkey/options', {
          body: { deviceId: DEVICE, credentialId: authenticator.lastId },
        }),
      );
      const answer = authenticator.get(asked); // counter 3
      const first = await call('POST', '/api/auth/passkey', {
        body: { deviceId: DEVICE, response: answer },
      });
      expect(first.status).toBe(200);
      const replay = await call('POST', '/api/auth/passkey', {
        body: { deviceId: DEVICE, response: answer },
      });
      expect(errorOf(replay)?.error).toBe('invalid_credentials');

      // Counter regression: a fresh challenge, but the authenticator claims counter 2 (a clone).
      expect(errorOf(await passkeySignIn(authenticator, DEVICE, { counter: 2 }))?.error).toBe(
        'invalid_credentials',
      );
      // Wrong site, and a signature that does not match.
      expect(
        errorOf(
          await passkeySignIn(authenticator, DEVICE, { origin: 'https://evil.test', counter: 10 }),
        )?.error,
      ).toBe('invalid_credentials');
      expect(
        errorOf(await passkeySignIn(authenticator, DEVICE, { breakSignature: true, counter: 11 }))
          ?.error,
      ).toBe('invalid_credentials');
      // None of those moved the stored counter: the next honest sign-in still works.
      expect((await passkeySignIn(authenticator, DEVICE, { counter: 12 })).status).toBe(200);
    });

    it('refuses an answer to a challenge it never made, or one made for another browser', async () => {
      await adminSignedIn();
      const made = optionsOf(
        await call('POST', '/api/auth/passkey/options', {
          body: { deviceId: DEVICE, credentialId: authenticator.lastId },
        }),
      );
      // Same answer, but sent as a different browser id.
      const reply = await call('POST', '/api/auth/passkey', {
        body: { deviceId: DEVICE_2, response: authenticator.get(made) },
      });
      expect(errorOf(reply)?.error).toBe('invalid_credentials');
      const invented = authenticator.get({
        challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      expect(
        errorOf(
          await call('POST', '/api/auth/passkey', {
            body: { deviceId: DEVICE, response: invented },
          }),
        )?.error,
      ).toBe('invalid_credentials');
    });

    it('expires a sign-in challenge after 5 minutes', async () => {
      await adminSignedIn();
      const made = optionsOf(
        await call('POST', '/api/auth/passkey/options', {
          body: { deviceId: DEVICE, credentialId: authenticator.lastId },
        }),
      );
      nowMs += 6 * MIN;
      const reply = await call('POST', '/api/auth/passkey', {
        body: { deviceId: DEVICE, response: authenticator.get(made) },
      });
      expect(errorOf(reply)?.error).toBe('invalid_credentials');
    });

    it('offers only the stored credential, and says nothing about an unknown one', async () => {
      await adminSignedIn();
      const known = optionsOf(
        await call('POST', '/api/auth/passkey/options', {
          body: { deviceId: DEVICE, credentialId: authenticator.lastId },
        }),
      );
      expect(known['allowCredentials']).toEqual([
        { id: authenticator.lastId, type: 'public-key', transports: ['internal'] },
      ]);
      const unknown = await call('POST', '/api/auth/passkey/options', {
        body: { deviceId: DEVICE, credentialId: 'nobody-has-this' },
      });
      expect(unknown.status).toBe(200);
      expect((optionsOf(unknown)['allowCredentials'] as Array<{ id: string }>)[0]?.id).toBe(
        'nobody-has-this',
      );
      // No credential at all: the browser lists what it holds.
      const open = optionsOf(
        await call('POST', '/api/auth/passkey/options', { body: { deviceId: DEVICE } }),
      );
      expect(open['allowCredentials']).toBeUndefined();
    });

    it('counts failed passkey tries toward the 5-try lockout', async () => {
      await adminSignedIn();
      let last: Reply | undefined;
      for (let i = 0; i < 5; i++) {
        last = await passkeySignIn(authenticator, DEVICE_2, {
          breakSignature: true,
          counter: 50 + i,
        });
      }
      expect(errorOf(last as Reply)).toMatchObject({ error: 'locked_out' });
      expect((await passkeySignIn(authenticator, DEVICE_2, { counter: 99 })).status).toBe(429);
      // Another browser id is not locked.
      expect((await passkeySignIn(authenticator, DEVICE, { counter: 100 })).status).toBe(200);
    });

    it('cannot use passkeys on an IP-address host (D-046), only the password', async () => {
      const setup = session(
        await call('POST', '/api/admin/setup', {
          body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
        }),
      );
      const asked = await call('POST', '/api/auth/register/options', {
        ...setup,
        host: '192.168.1.20:5173',
      });
      expect(asked.status).toBe(400);
      expect(errorOf(asked)?.error).toBe('invalid_request');
      const signIn = await call('POST', '/api/auth/passkey/options', {
        host: '192.168.1.20:5173',
        body: { deviceId: DEVICE },
      });
      expect(signIn.status).toBe(400);
      // Passwords work there as ever (a seller account).
      const admin = await registerPasskey(setup.token, 'Laptop');
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const started = session(
        await call('POST', '/api/auth/invite', {
          host: '192.168.1.20:5173',
          body: { key: invite.key, deviceId: DEVICE_2 },
        }),
      );
      const done = await call('POST', '/api/auth/register', {
        token: started.token,
        host: '192.168.1.20:5173',
        body: { kind: 'password', password: 'correct horse battery', deviceName: 'Phone' },
      });
      expect(done.status).toBe(201);
    });
  });

  describe('session cookie and request limits (stage 8.2)', () => {
    it('sets an HttpOnly, Secure, Strict __Host- cookie and keeps the token out of the body', async () => {
      const reply = await call('POST', '/api/admin/setup', {
        body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: DEVICE },
      });
      // A setup session lasts 60 minutes.
      expect(reply.setCookie).toMatch(
        /^__Host-session=[^;]+; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600$/,
      );
      const admin = await adminSignedIn();
      const full = await call('GET', '/api/auth/me', admin);
      // A full session: 30 days, and renewed on use.
      expect(full.setCookie).toBe(
        `__Host-session=${admin.token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`,
      );
      expect(JSON.stringify(reply.body)).not.toContain(session(reply).token);
      expect(JSON.stringify(admin)).toContain('"token"'); // only our helper adds it
      expect(JSON.stringify(parseSessionResponse(admin))).not.toContain('token');
    });

    it('has no Domain attribute (the __Host- rule), and the token is 40 random characters', async () => {
      const admin = await adminSignedIn();
      const reply = await call('GET', '/api/auth/me', admin);
      expect(reply.setCookie).not.toMatch(/Domain=/i);
      expect(admin.token).toMatch(/^[0-9A-Z]{40}$/);
    });

    it('resolves a session from the cookie alone, and clears it on sign-out', async () => {
      const admin = await adminSignedIn();
      expect((await call('GET', '/api/auth/me', admin)).status).toBe(200);
      // Other cookies around it do not matter.
      const mixed = await call('GET', '/api/auth/me', {
        headers: { Cookie: `theme=dark; __Host-session=${admin.token}; other=1` },
      });
      expect(mixed.status).toBe(200);
      const out = await call('POST', '/api/auth/sign-out', admin);
      expect(out.setCookie).toMatch(
        /^__Host-session=; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=0$/,
      );
      expect((await call('GET', '/api/auth/me', admin)).status).toBe(401);
    });

    it('clears a cookie the server no longer knows', async () => {
      const gone = await call('GET', '/api/auth/me', { token: 'GONE' });
      expect(gone.status).toBe(401);
      expect(gone.setCookie).toMatch(/Max-Age=0$/);
      const none = await call('GET', '/api/auth/me');
      expect(none.status).toBe(401);
      expect(none.setCookie).toBeNull();
    });

    it('lets a session cookie win over the dev X-Seller header', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const reply = await call('GET', '/api/seller/orders', {
        ...full,
        headers: { 'X-Seller': B },
      });
      expect(reply.status).toBe(200);
      expect(
        (await call('GET', '/api/seller/orders', { token: 'stale', headers: { 'X-Seller': B } }))
          .status,
      ).toBe(401);
    });

    it('limits sign-in requests to 30 a minute per browser id, then lets them through again', async () => {
      let last: Reply | undefined;
      for (let i = 0; i < 31; i++) {
        last = await call('POST', '/api/auth/passkey/options', { body: { deviceId: DEVICE } });
      }
      const refusal = errorOf(last as Reply);
      expect(last?.status).toBe(429);
      expect(refusal?.error).toBe('locked_out');
      expect(refusal?.retryAfterSeconds).toBeGreaterThan(0);
      expect(refusal?.retryAfterSeconds).toBeLessThanOrEqual(60);
      // Another browser id has its own allowance.
      const other = await call('POST', '/api/auth/passkey/options', {
        body: { deviceId: DEVICE_2 },
      });
      expect(other.status).toBe(200);
      nowMs += 61_000;
      const later = await call('POST', '/api/auth/passkey/options', { body: { deviceId: DEVICE } });
      expect(later.status).toBe(200);
    });
  });

  describe('lockout', () => {
    const wrongKey = (deviceId = DEVICE) =>
      call('POST', '/api/auth/invite', { body: { key: 'DLV-AAAA-BBBB-CCCC-DDDD', deviceId } });

    it('counts down the tries, then locks the device for 15 minutes', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      const left: Array<number | undefined> = [];
      for (let i = 0; i < 4; i++) left.push(errorOf(await wrongKey())?.triesLeft);
      expect(left).toEqual([4, 3, 2, 1]);
      const fifth = await wrongKey();
      expect(fifth.status).toBe(429);
      expect(errorOf(fifth)).toMatchObject({ error: 'locked_out', retryAfterSeconds: 900 });

      nowMs += 5 * MIN;
      expect(errorOf(await wrongKey())).toMatchObject({
        error: 'locked_out',
        retryAfterSeconds: 600,
      });
      // A valid key is refused too while locked.
      const locked = await call('POST', '/api/auth/invite', {
        body: { key: invite.key, deviceId: DEVICE },
      });
      expect(errorOf(locked)?.error).toBe('locked_out');
      // Another device is not locked.
      const other = await call('POST', '/api/auth/invite', {
        body: { key: invite.key, deviceId: 'phone-0002-bbbb' },
      });
      expect(other.status).toBe(200);

      nowMs += 10 * MIN;
      expect(errorOf(await wrongKey())?.triesLeft).toBe(4);
    });

    it('resets the count after a success', async () => {
      const admin = await adminSignedIn();
      const invite = key(await call('POST', `/api/admin/sellers/${A_ID}/invite-key`, admin));
      for (let i = 0; i < 3; i++) await wrongKey('phone-0002-bbbb');
      const good = await call('POST', '/api/auth/invite', {
        body: { key: invite.key, deviceId: 'phone-0002-bbbb' },
      });
      expect(good.status).toBe(200);
      expect(errorOf(await wrongKey('phone-0002-bbbb'))?.triesLeft).toBe(4);
    });

    it('also locks per seller across devices for password tries', async () => {
      await sellerSignedIn(A_ID);
      const accountId = await personId(A, OWNER_A);
      const wrong = (deviceId: string) =>
        call('POST', '/api/auth/password', {
          body: { slug: A, accountId, password: 'wrong password!', deviceId, deviceName: 'X' },
        });
      for (let i = 0; i < 4; i++) await wrong(`phone-000${String(i)}-xxxx`);
      const fifth = await wrong('phone-0005-xxxx');
      expect(errorOf(fifth)?.error).toBe('locked_out');
      // A brand new device is refused too: the seller is locked.
      const sixth = await call('POST', '/api/auth/password', {
        body: {
          slug: A,
          accountId,
          password: 'correct horse battery',
          deviceId: 'phone-0009-yyyy',
          deviceName: 'X',
        },
      });
      expect(errorOf(sixth)?.error).toBe('locked_out');
      // The other seller is unaffected.
      const b = await call('POST', '/api/auth/password', {
        body: {
          slug: B,
          accountId,
          password: 'whatever it is',
          deviceId: 'phone-0009-yyyy',
          deviceName: 'X',
        },
      });
      expect(errorOf(b)).toMatchObject({ error: 'invalid_credentials', triesLeft: 4 });
    });

    it('counts wrong add-device codes', async () => {
      const wrong = () =>
        call('POST', '/api/auth/code', { body: { code: '000000', deviceId: DEVICE } });
      for (let i = 0; i < 4; i++) await wrong();
      expect(errorOf(await wrong())?.error).toBe('locked_out');
    });
  });

  describe('seller isolation with sessions', () => {
    async function place(slug: string, itemId: string) {
      const reply = await call('POST', `/api/s/${slug}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId, qty: 1 }],
        },
      });
      if (reply.status !== 201) throw new Error(JSON.stringify(reply));
    }

    it('a session for seller A never acts as seller B, even with X-Seller: B', async () => {
      const a = await sellerSignedIn(A_ID);
      await place(A, 'pesmol');
      await place(B, 'soto-ayam');
      const list = await call('GET', '/api/seller/orders', {
        token: a.full.token,
        headers: { 'X-Seller': B },
      });
      const orders = parseSellerOrdersResponse(list.body)?.orders ?? [];
      expect(orders).toHaveLength(1);
      expect(orders.every((order) => order.sellerId === A_ID)).toBe(true);
      // The audit name comes from the session, not X-Actor.
      const code = orders[0]?.code ?? '';
      const moved = await call('POST', `/api/seller/orders/${code}/status`, {
        token: a.full.token,
        headers: { 'X-Seller': B, 'X-Actor': 'chef:Somebody' },
        body: { to: 'confirmed' },
      });
      expect(parseSellerOrderResponse(moved.body)?.order.audit[0]?.by).toEqual({
        role: 'seller',
        name: 'Onde Onde',
      });
      // B's order code is not reachable through A's session.
      const bOrders = parseSellerOrdersResponse(
        (await call('GET', '/api/seller/orders', { headers: { 'X-Seller': B } })).body,
      )?.orders;
      const bCode = bOrders?.[0]?.code ?? '';
      const peek = await call('GET', `/api/seller/orders/${bCode}`, {
        token: a.full.token,
        headers: { 'X-Seller': B },
      });
      expect(peek.status).toBe(404);
    });

    it('still lets the dev X-Seller header work without a session', async () => {
      await place(B, 'soto-ayam');
      const orders = parseSellerOrdersResponse(
        (await call('GET', '/api/seller/orders', { headers: { 'X-Seller': B } })).body,
      )?.orders;
      expect(orders).toHaveLength(1);
    });

    it('refuses the admin on seller endpoints: the admin sees no order data', async () => {
      const admin = await adminSignedIn();
      await place(A, 'pesmol');
      for (const [method, path] of [
        ['GET', '/api/seller/orders'],
        ['GET', '/api/seller/menu'],
        ['GET', '/api/seller/orders.csv'],
        ['GET', '/api/seller/backup'],
      ] as const) {
        expect((await call(method, path, admin)).status, path).toBe(403);
      }
      expect(
        (await call('GET', '/api/seller/orders', { ...admin, headers: { 'X-Seller': A } })).status,
      ).toBe(403);
    });

    it('removing a chef signs the chef out', async () => {
      const seller = await sellerSignedIn(A_ID);
      const chef = key(
        await call('POST', '/api/seller/chef-invites', {
          ...seller.full,
          body: { chefId: 'wati' },
        }),
      );
      const setup = session(
        await call('POST', '/api/auth/invite', {
          body: { key: chef.key, deviceId: 'chef-0001-aaaa' },
        }),
      );
      const full = await registerPasskey(setup.token, 'Wati phone', new SoftAuthenticator(SITE));
      expect(full.me).toMatchObject({
        role: 'chef',
        chefId: 'wati',
        chefName: 'Chef Wati',
        slug: A,
      });
      await call('DELETE', '/api/seller/chefs/wati', seller.full);
      expect((await call('GET', '/api/auth/me', full)).status).toBe(401);
    });
  });

  describe('chef permissions (D-013)', () => {
    async function chefSession() {
      const seller = await sellerSignedIn(A_ID);
      const invite = key(
        await call('POST', '/api/seller/chef-invites', {
          ...seller.full,
          body: { chefId: 'wati' },
        }),
      );
      const setup = session(
        await call('POST', '/api/auth/invite', {
          body: { key: invite.key, deviceId: 'chef-0001-aaaa' },
        }),
      );
      const chef = session(
        await call('POST', '/api/auth/register', {
          token: setup.token,
          body: { kind: 'password', password: 'chef long password', deviceName: 'Wati phone' },
        }),
      );
      return { seller, chef };
    }

    it('lets the seller invite only an existing chef, with the same key rules', async () => {
      const { seller } = await chefSession();
      const unknown = await call('POST', '/api/seller/chef-invites', {
        ...seller.full,
        body: { chefId: 'nobody' },
      });
      expect(errorOf(unknown)?.error).toBe('unknown_chef');
      const invite = key(
        await call('POST', '/api/seller/chef-invites', {
          ...seller.full,
          body: { chefId: 'wati' },
        }),
      );
      expect(Date.parse(invite.expiresAt)).toBe(START + DAY);
      expect(await world.dumpSecrets()).not.toContain(invite.key);
    });

    it('signs the chef in by password, picked by name, and audits under the chef name', async () => {
      const { chef } = await chefSession();
      expect(chef.me).toMatchObject({ role: 'chef', chefName: 'Chef Wati' });
      const chefAccount = await personId(A, 'Chef Wati');
      const signIn = await call('POST', '/api/auth/password', {
        body: {
          slug: A,
          accountId: chefAccount,
          password: 'chef long password',
          deviceId: DEVICE,
          deviceName: 'Second phone',
        },
      });
      expect(session(signIn).me.role).toBe('chef');
      // The seller's own password does not open the chef account, and vice versa.
      const mixed = await call('POST', '/api/auth/password', {
        body: {
          slug: A,
          accountId: chefAccount,
          password: 'correct horse battery',
          deviceId: DEVICE_2,
          deviceName: 'X',
        },
      });
      expect(errorOf(mixed)?.error).toBe('invalid_credentials');
    });

    it('lets a chef add made counts, and the seller sees them (plan 035)', async () => {
      const { seller, chef } = await chefSession();
      const add = await call('POST', '/api/seller/made', {
        ...chef,
        body: { itemId: 'pesmol', delta: 2 },
      });
      expect(add).toMatchObject({ status: 200, body: { made: { pesmol: 2 } } });
      const read = await call('GET', '/api/seller/made', seller.full);
      expect(read.body).toEqual({ made: { pesmol: 2 } });
    });

    it('does everything the seller does with orders', async () => {
      const { chef } = await chefSession();
      const placed = await call('POST', `/api/s/${A}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      expect(placed.status).toBe(201);
      const list = parseSellerOrdersResponse((await call('GET', '/api/seller/orders', chef)).body);
      const code = list?.orders[0]?.code ?? '';
      for (const [path, body] of [
        [`/api/seller/orders/${code}/status`, { to: 'confirmed' }],
        [`/api/seller/orders/${code}/paid`, { paid: true }],
        [`/api/seller/orders/${code}/lock`, { locked: true }],
        [`/api/seller/orders/${code}/wa-received`, { received: true }],
        [`/api/seller/orders/${code}/nudge`, undefined],
        [`/api/seller/orders/${code}/seen`, undefined],
      ] as const) {
        const reply = await call('POST', path, { ...chef, ...(body ? { body } : {}) });
        expect(reply.status, path).toBe(200);
      }
      const created = await call('POST', '/api/seller/orders', {
        ...chef,
        body: {
          firstName: 'Tono',
          language: 'id',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      expect(parseSellerOrderResponse(created.body)?.order.enteredBy).toEqual({
        role: 'chef',
        name: 'Chef Wati',
      });
      for (const path of [
        '/api/seller/menu',
        '/api/seller/chefs',
        '/api/seller/settings',
        '/api/seller/menus/current',
        '/api/seller/saved-sets',
        '/api/seller/dishes',
        '/api/seller/pickup-places',
        '/api/seller/preferences',
        '/api/seller/images',
        '/api/seller/past-weeks',
        '/api/seller/orders.csv',
      ]) {
        expect((await call('GET', path, chef)).status, path).toBe(200);
      }
      const update = await call('POST', '/api/seller/updates', {
        ...chef,
        body: { template: 'arrived', codes: [code] },
      });
      expect(update.status).toBe(200);
    });

    it('refuses every forbidden route with 403 forbidden, and the seller may use them', async () => {
      const { chef, seller } = await chefSession();
      const forbidden: Array<[string, string, unknown?]> = [
        // POST /api/seller/dishes is open to a chef since plan 030 (mocks/chefDishes.test.ts)
        ['PATCH', '/api/seller/dishes/pesmol', { priceCents: 200 }],
        ['DELETE', '/api/seller/dishes/pesmol'],
        ['PUT', '/api/seller/menus/current', { dishIds: [] }],
        ['POST', '/api/seller/menus', {}],
        ['POST', '/api/seller/chefs', { name: 'New chef' }],
        ['PATCH', '/api/seller/chefs/wati', { name: 'Renamed' }],
        ['DELETE', '/api/seller/chefs/wati'],
        ['POST', '/api/seller/chef-invites', { chefId: 'wati' }],
        ['GET', '/api/seller/chef-devices'],
        ['PUT', '/api/seller/images/desktopBanner', { dataUrl: 'data:image/png;base64,AAAA' }],
        ['DELETE', '/api/seller/images/desktopBanner'],
        ['PUT', '/api/seller/images', {}],
        ['POST', '/api/seller/menus/current/publish'],
        ['POST', '/api/seller/menus/current/unpublish'],
        ['POST', '/api/seller/menus/current/finish'],
        ['PUT', '/api/seller/pickup-places/box-hill', {}],
        ['PUT', '/api/seller/preferences', {}],
        ['PUT', '/api/seller/settings', {}],
        ['GET', '/api/seller/backup'],
        ['POST', '/api/seller/backup', {}],
        ['POST', '/api/seller/saved-sets', { name: 'Set' }],
        ['PATCH', '/api/seller/saved-sets/x', { name: 'Set' }],
        ['DELETE', '/api/seller/saved-sets/x'],
        ['POST', '/api/seller/saved-sets/x/use', {}],
      ];
      for (const [method, path, body] of forbidden) {
        const reply = await call(method, path, {
          ...chef,
          ...(body !== undefined ? { body } : {}),
        });
        expect(reply.status, `${method} ${path}`).toBe(403);
        expect(errorOf(reply)?.error, `${method} ${path}`).toBe('forbidden');
      }
      // The seller gets past the permission check on the same routes (any answer but 403).
      for (const [method, path, body] of forbidden) {
        if (path.includes('/chefs/wati') && method === 'DELETE') continue; // keep wati for the other checks
        const reply = await call(method, path, {
          ...seller.full,
          ...(body !== undefined ? { body } : {}),
        });
        expect(reply.status, `seller ${method} ${path}`).not.toBe(403);
      }
    });
  });

  describe('admin: chefs (read-only) and sign out all', () => {
    async function chefOnTwoDevices() {
      const seller = await sellerSignedIn(A_ID);
      const devices = ['chef-0001-aaaa', 'chef-0002-bbbb'];
      const tokens: Array<string> = [];
      // A key admits one device (D-085), so two phones are two invites.
      for (const [index, deviceId] of devices.entries()) {
        const invite = key(
          await call('POST', '/api/seller/chef-invites', {
            ...seller.full,
            body: { chefId: 'wati' },
          }),
        );
        const setup = session(
          await call('POST', '/api/auth/invite', { body: { key: invite.key, deviceId } }),
        );
        const full = session(
          await call('POST', '/api/auth/register', {
            token: setup.token,
            body: {
              kind: 'password',
              password: 'chef long password',
              deviceName: `Wati ${String(index)}`,
            },
          }),
        );
        tokens.push(full.token);
      }
      return { seller, tokens };
    }

    it('lists the seller chefs with device counts, and nothing else', async () => {
      const admin = await adminSignedIn();
      const before = await call('GET', `/api/admin/sellers/${A_ID}/chefs`, admin);
      expect(parseChefAccessResponse(before.body)?.chefs).toEqual([
        { id: 'wati', name: 'Chef Wati', devices: 0 },
      ]);
      await chefOnTwoDevices();
      const after = await call('GET', `/api/admin/sellers/${A_ID}/chefs`, admin);
      expect(parseChefAccessResponse(after.body)?.chefs[0]?.devices).toBe(2);
      expect(Object.keys((after.body as { chefs: Array<object> }).chefs[0] ?? {}).sort()).toEqual([
        'devices',
        'id',
        'name',
      ]);
      expect(errorOf(await call('GET', '/api/admin/sellers/nope/chefs', admin))?.error).toBe(
        'seller_not_found',
      );
      // The admin still has no order data.
      expect((await call('GET', '/api/seller/orders', admin)).status).toBe(403);
    });

    it('signs out every session of the chef here, and the others stay signed in', async () => {
      const { seller, tokens } = await chefOnTwoDevices();
      const admin = await adminSignedIn();
      const path = `/api/admin/sellers/${A_ID}/chefs/wati/sign-out-all`;
      expect((await call('POST', path, admin)).status).toBe(200);
      for (const token of tokens) {
        expect((await call('GET', '/api/auth/me', { token })).status).toBe(401);
      }
      // Sessions end; the devices stay on the people (removing the member is what shuts the door).
      const list = await call('GET', `/api/admin/sellers/${A_ID}/chefs`, admin);
      expect(parseChefAccessResponse(list.body)?.chefs[0]?.devices).toBe(2);
      expect((await call('GET', '/api/auth/me', seller.full)).status).toBe(200);
      expect(
        errorOf(await call('POST', `/api/admin/sellers/${A_ID}/chefs/nobody/sign-out-all`, admin))
          ?.error,
      ).toBe('unknown_chef');
    });

    it('shows the seller their own chefs with device counts, and refuses chefs', async () => {
      const { seller, tokens } = await chefOnTwoDevices();
      const own = await call('GET', '/api/seller/chef-devices', seller.full);
      expect(parseChefAccessResponse(own.body)?.chefs).toEqual([
        { id: 'wati', name: 'Chef Wati', devices: 2 },
      ]);
      const asChef = await call('GET', '/api/seller/chef-devices', { token: tokens[0] ?? '' });
      expect(asChef.status).toBe(403);
    });
  });

  describe('people and memberships (plan 033)', () => {
    const placeOrder = (slug: string, itemId: string, firstName: string) =>
      call('POST', `/api/s/${slug}/orders`, {
        body: { firstName, language: 'en', fulfilment: 'pickup', lines: [{ itemId, qty: 1 }] },
      });
    const namesOf = async (token: string) =>
      (
        parseSellerOrdersResponse((await call('GET', '/api/seller/orders', { token })).body)
          ?.orders ?? []
      ).map((order) => order.firstName);
    const adminInvite = async (admin: Login, sellerId: string, displayName?: string) =>
      key(
        await call('POST', `/api/admin/sellers/${sellerId}/invite-key`, {
          ...admin,
          ...(displayName ? { body: { displayName } } : {}),
        }),
      );
    const redeem = (inviteKey: string, deviceId: string, token?: string, displayName?: string) =>
      call('POST', '/api/auth/invite', {
        ...(token ? { token } : {}),
        body: { key: inviteKey, deviceId, ...(displayName ? { displayName } : {}) },
      });
    /** A new person from an admin invite, finished with a password. */
    async function newOwner(admin: Login, sellerId: string, name: string, deviceId: string) {
      const invite = await adminInvite(admin, sellerId, name);
      const setup = session(await redeem(invite.key, deviceId));
      return session(
        await call('POST', '/api/auth/register', {
          token: setup.token,
          body: { kind: 'password', password: 'correct horse battery', deviceName: 'Phone' },
        }),
      );
    }

    it('lists the newest 20 invites of a kitchen: waiting, used and expired, never the key (plan 043)', async () => {
      const admin = await adminSignedIn();
      const invitesOf = async (sellerId: string) =>
        parseInvitesResponse(
          (await call('GET', `/api/admin/sellers/${sellerId}/invites`, admin)).body,
        )?.invites ?? [];
      expect(await invitesOf(A_ID)).toEqual([]);

      const used = await adminInvite(admin, A_ID, 'Used one');
      expect((await redeem(used.key, 'dev-used-0001')).status).toBe(200);
      await adminInvite(admin, A_ID, 'Old one');
      nowMs += 25 * 60 * MIN;
      await adminInvite(admin, A_ID, 'Fresh one');
      await adminInvite(admin, B_ID, 'Other kitchen');

      const invites = await invitesOf(A_ID);
      expect(invites.map((invite) => [invite.displayName, invite.status])).toEqual([
        ['Fresh one', 'waiting'],
        ['Old one', 'expired'],
        ['Used one', 'used'],
      ]);
      expect(invites[2]?.usedAt).toBeDefined();
      expect(invites.every((invite) => invite.role === 'owner')).toBe(true);
      expect(JSON.stringify(invites)).not.toContain(used.key);

      for (let i = 0; i < 22; i += 1) await adminInvite(admin, A_ID, `Many ${i}`);
      const newest = await invitesOf(A_ID);
      expect(newest).toHaveLength(20);
      expect(newest[0]?.displayName).toBe('Many 21');
    });

    it('a key redeemed from two devices at once admits exactly one', async () => {
      const admin = await adminSignedIn();
      const invite = await adminInvite(admin, A_ID, 'Race');
      const replies = await Promise.all([
        redeem(invite.key, 'racer-0001-aaaa'),
        redeem(invite.key, 'racer-0002-bbbb'),
      ]);
      expect(replies.map((reply) => reply.status).sort()).toEqual([200, 401]);
    });

    it('one person in two kitchens: joining adds a membership without a new passkey, and switching shows only each kitchen data', async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      await placeOrder(A, 'pesmol', 'Rina');
      await placeOrder(B, 'soto-ayam', 'Tono');
      const inviteB = await adminInvite(admin, B_ID);
      const joined = await redeem(inviteB.key, DEVICE, full.token);
      expect(joined.status).toBe(200);
      const joinedSession = session(joined);
      // The same session (cookie), the same single device: nothing new to register.
      expect(joinedSession.token).toBe(full.token);
      expect(joinedSession.me).toMatchObject({ stage: 'full', slug: B, role: 'seller' });
      const devices = parseDevicesResponse(
        (await call('GET', '/api/auth/devices', full)).body,
      )?.devices;
      expect(devices).toHaveLength(1);

      const list = parseMembershipsResponse(
        (await call('GET', '/api/auth/memberships', full)).body,
      );
      expect(list?.memberships.map((row) => [row.slug, row.role])).toEqual([
        [A, 'owner'],
        [B, 'owner'],
      ]);

      expect(await namesOf(full.token)).toEqual(['Tono']);
      const toA = await call('POST', '/api/auth/switch', { ...full, body: { sellerId: A_ID } });
      expect(parseMeResponse(toA.body)?.me).toMatchObject({ slug: A, sellerId: A_ID });
      expect(await namesOf(full.token)).toEqual(['Rina']);
      expect(parseMeResponse((await call('GET', '/api/auth/me', full)).body)?.me.slug).toBe(A);

      // A kitchen the person does not belong to cannot be switched to.
      const made = await call('POST', '/api/admin/sellers', {
        ...admin,
        body: { name: 'Third', slug: 'third' },
      });
      expect(made.status).toBe(201);
      const third = await call('POST', '/api/auth/switch', {
        ...full,
        body: { sellerId: 'seller-third' },
      });
      expect(errorOf(third)?.error).toBe('forbidden');
      const unknown = await call('POST', '/api/auth/switch', { ...full, body: { sellerId: 'x' } });
      expect(unknown.status).toBe(403);
      expect(parseMeResponse((await call('GET', '/api/auth/me', full)).body)?.me.slug).toBe(A);
    });

    it('joins only once: the key is spent, and a member cannot join the same kitchen again', async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      const inviteB = await adminInvite(admin, B_ID);
      expect((await redeem(inviteB.key, DEVICE, full.token)).status).toBe(200);
      expect((await redeem(inviteB.key, DEVICE_2, full.token)).status).toBe(401);
      expect((await redeem(inviteB.key, DEVICE_2)).status).toBe(401);
      const again = await adminInvite(admin, B_ID);
      const twice = await redeem(again.key, 'phone-0003-cccc', full.token);
      expect(errorOf(twice)?.error).toBe('invalid_request');
      // The refused join did not spend the key.
      const stranger = await redeem(again.key, 'phone-0004-dddd');
      expect(session(stranger).me.stage).toBe('setup');
    });

    it('makes a new person with the invite name, or the name they edited', async () => {
      const admin = await adminSignedIn();
      const named = await adminInvite(admin, A_ID, 'Bu Sari');
      expect(session(await redeem(named.key, DEVICE)).me).toMatchObject({
        displayName: 'Bu Sari',
        role: 'seller',
        stage: 'setup',
      });
      const edited = await adminInvite(admin, A_ID, 'Bu Sari');
      expect(session(await redeem(edited.key, DEVICE_2, undefined, 'Sari W')).me.displayName).toBe(
        'Sari W',
      );
    });

    it('lists password sign-in names for that kitchen only, people with a password', async () => {
      const admin = await adminSignedIn();
      const none = await call('GET', `/api/s/${A}/team-names`);
      expect(parseTeamNamesResponse(none.body)?.names).toEqual([]);
      await newOwner(admin, A_ID, 'Bu Sari', DEVICE);
      const names = parseTeamNamesResponse((await call('GET', `/api/s/${A}/team-names`)).body);
      expect(names?.names.map((name) => name.displayName)).toEqual(['Bu Sari']);
      expect(
        parseTeamNamesResponse((await call('GET', `/api/s/${B}/team-names`)).body)?.names,
      ).toEqual([]);
      expect((await call('GET', '/api/s/nobody/team-names')).status).toBe(404);
      // A person of kitchen A cannot sign in to kitchen B by password.
      const accountId = await personId(A, 'Bu Sari');
      const cross = await call('POST', '/api/auth/password', {
        body: {
          slug: B,
          accountId,
          password: 'correct horse battery',
          deviceId: DEVICE_2,
          deviceName: 'X',
        },
      });
      expect(errorOf(cross)?.error).toBe('invalid_credentials');
    });

    it('opens the asked kitchen at passkey sign-in, else the first one', async () => {
      const admin = await adminSignedIn();
      const mine = new SoftAuthenticator(SITE);
      const invite = await adminInvite(admin, A_ID, 'Bu Sari');
      const setup = session(await redeem(invite.key, 'phone-0001-aaaa'));
      const full = await registerPasskey(setup.token, 'Phone', mine);
      const inviteB = await adminInvite(admin, B_ID);
      expect((await redeem(inviteB.key, 'phone-0001-aaaa', full.token)).status).toBe(200);

      const signIn = async (deviceId: string, slug?: string) => {
        const asked = await call('POST', '/api/auth/passkey/options', {
          body: { deviceId, credentialId: mine.lastId },
        });
        const options = (asked.body as { options: Record<string, unknown> }).options;
        return call('POST', '/api/auth/passkey', {
          body: { deviceId, response: mine.get(options as never), ...(slug ? { slug } : {}) },
        });
      };
      expect(session(await signIn('phone-0002-bbbb')).me).toMatchObject({ slug: A });
      const second = session(await signIn('phone-0003-cccc', B));
      expect(second.me).toMatchObject({ slug: B, displayName: 'Bu Sari' });
      // A kitchen they do not belong to falls back to the first one.
      await call('POST', '/api/admin/sellers', {
        ...admin,
        body: { name: 'Third', slug: 'third' },
      });
      expect(session(await signIn('phone-0004-dddd', 'third')).me.slug).toBe(A);
    });

    it('refuses a removed member on the next request, and leaves their other kitchens', async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      const inviteB = await adminInvite(admin, B_ID);
      expect((await redeem(inviteB.key, DEVICE, full.token)).status).toBe(200);
      const me = parseMeResponse((await call('GET', '/api/auth/me', full)).body)?.me;
      expect(me?.slug).toBe(B);
      const members = parseMembersResponse(
        (await call('GET', `/api/admin/sellers/${A_ID}/members`, admin)).body,
      )?.members;
      expect(members).toEqual([
        expect.objectContaining({ displayName: OWNER_A, role: 'owner', devices: 1 }),
      ]);
      const accountId = members?.[0]?.accountId ?? '';

      // Active in B: removing from A leaves this session alone.
      expect(
        (await call('DELETE', `/api/admin/sellers/${A_ID}/members/${accountId}`, admin)).status,
      ).toBe(200);
      expect((await call('GET', '/api/seller/orders', full)).status).toBe(200);
      const toA = await call('POST', '/api/auth/switch', { ...full, body: { sellerId: A_ID } });
      expect(toA.status).toBe(403);
      expect(
        (await call('DELETE', `/api/admin/sellers/${A_ID}/members/${accountId}`, admin)).status,
      ).toBe(404);

      // Removed from the kitchen the session is in: refused at once.
      expect(
        (await call('DELETE', `/api/admin/sellers/${B_ID}/members/${accountId}`, admin)).status,
      ).toBe(200);
      expect((await call('GET', '/api/seller/orders', full)).status).toBe(401);
      expect((await call('GET', '/api/auth/me', full)).status).toBe(401);
      // With no kitchen left the person is gone, devices included.
      expect(
        (
          await call('POST', '/api/auth/password', {
            body: {
              slug: A,
              accountId,
              password: 'correct horse battery',
              deviceId: DEVICE_2,
              deviceName: 'X',
            },
          })
        ).status,
      ).toBe(401);
      const list = parseDevicesResponse(
        (await call('GET', `/api/admin/sellers/${A_ID}/devices`, admin)).body,
      );
      expect(list?.devices).toEqual([]);
    });

    it('the owner invites by name and role, sees the team, and removes a member', async () => {
      const { full } = await sellerSignedIn(A_ID);
      const chefInvite = key(
        await call('POST', '/api/seller/invites', {
          ...full,
          body: { displayName: 'Dewi', role: 'chef' },
        }),
      );
      expect(chefInvite.maxDevices).toBe(1);
      // A chef invite with no cook makes the cook row.
      const cooks = (
        (await call('GET', '/api/seller/chefs', full)).body as { chefs: Array<{ name: string }> }
      ).chefs;
      expect(cooks.map((cook) => cook.name)).toContain('Dewi');
      const setup = session(await redeem(chefInvite.key, 'chef-0001-aaaa'));
      const dewi = session(
        await call('POST', '/api/auth/register', {
          token: setup.token,
          body: { kind: 'password', password: 'chef long password', deviceName: 'Dewi phone' },
        }),
      );
      expect(dewi.me).toMatchObject({ role: 'chef', chefName: 'Dewi', displayName: 'Dewi' });

      const team = parseMembersResponse((await call('GET', '/api/seller/team', full)).body);
      expect(team?.members.map((m) => [m.displayName, m.role, m.devices, m.you === true])).toEqual([
        [OWNER_A, 'owner', 1, true],
        ['Dewi', 'chef', 1, false],
      ]);
      // The chef cannot invite, see the team, or remove anyone.
      const chefTries: Array<[string, string, unknown?]> = [
        ['POST', '/api/seller/invites', { displayName: 'X', role: 'owner' }],
        ['GET', '/api/seller/team'],
        ['DELETE', `/api/seller/team/${team?.members[0]?.accountId ?? ''}`],
      ];
      for (const [method, path, body] of chefTries) {
        const reply = await call(method, path, { ...dewi, ...(body ? { body } : {}) });
        expect(reply.status, `${method} ${path}`).toBe(403);
      }
      // An owner invite makes an owner.
      const ownerInvite = key(
        await call('POST', '/api/seller/invites', {
          ...full,
          body: { displayName: 'Pak Budi', role: 'owner' },
        }),
      );
      expect(session(await redeem(ownerInvite.key, 'owner-0002-bbbb')).me.role).toBe('seller');

      // Removing a member ends their access at once; the owner cannot remove themselves.
      const own = team?.members[0]?.accountId ?? '';
      expect((await call('DELETE', `/api/seller/team/${own}`, full)).status).toBe(400);
      const dewiId = team?.members[1]?.accountId ?? '';
      expect((await call('DELETE', `/api/seller/team/${dewiId}`, full)).status).toBe(200);
      expect((await call('GET', '/api/seller/orders', dewi)).status).toBe(401);
      expect((await call('DELETE', `/api/seller/team/${dewiId}`, full)).status).toBe(404);
    });

    it('a chef membership is closed out of owner routes, and an owner of another kitchen cannot reach this one', async () => {
      const { admin, full } = await sellerSignedIn(A_ID);
      const other = await newOwner(admin, B_ID, 'Pak Budi', 'phone-0007-gggg');
      // Pak Budi owns B only: his session never sees A's data.
      await placeOrder(A, 'pesmol', 'Rina');
      expect(await namesOf(other.token)).toEqual([]);
      expect(await namesOf(full.token)).toEqual(['Rina']);
      const chefInvite = key(
        await call('POST', '/api/seller/chef-invites', { ...full, body: { chefId: 'wati' } }),
      );
      const setup = session(await redeem(chefInvite.key, 'chef-0001-aaaa'));
      const chef = session(
        await call('POST', '/api/auth/register', {
          token: setup.token,
          body: { kind: 'password', password: 'chef long password', deviceName: 'Phone' },
        }),
      );
      for (const [method, path] of [
        ['PATCH', '/api/seller/settings'],
        ['POST', '/api/seller/chefs'],
        ['DELETE', '/api/seller/chefs/wati'],
        ['GET', '/api/seller/backup'],
      ] as const) {
        expect(
          (await call(method, path, { ...chef, ...(method === 'GET' ? {} : { body: {} }) })).status,
          path,
        ).toBe(403);
      }
      // Admin routes stay for the admin only.
      expect((await call('GET', '/api/admin/sellers', chef)).status).toBe(403);
      expect((await call('GET', '/api/admin/sellers', full)).status).toBe(403);
      expect((await call('GET', `/api/admin/sellers/${A_ID}/members`, chef)).status).toBe(403);
    });
  });
});
