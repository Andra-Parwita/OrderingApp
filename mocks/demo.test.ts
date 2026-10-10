// @vitest-environment node
// Plan 013 (D-076): the demo kitchen. Every call goes through `handleWorkerRequest` with DEV_TOOLS
// off, the way production runs: the Origin check is at the door and the sample routes depend only
// on the signed-in kitchen being a demo one. Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import { parseMeResponse, parseSellerResponse } from '../shared/authContract';
import { parseClearSamplesResponse, parseSampleOrdersResponse } from '../shared/devContract';
import { handleWorkerRequest, type ApiEnv } from '../worker/api';
import { DEV_ADMIN_SETUP_KEY, useWorld, type World } from './impl';

const SITE = 'https://delave.test';
const A = 'onde-onde';
const B = 'dapur-demo';
const A_ID = 'seller-onde-onde';
const B_ID = 'seller-dapur-demo';
const PASSWORD = 'correct horse battery';

describe('demo kitchen', () => {
  const create = useWorld('demo');
  let world: World;
  let env: ApiEnv;
  let admin: string;
  let sellerA: string;
  let sellerB: string;
  let tokenCounter = 0;

  async function call(
    method: string,
    path: string,
    options: {
      token?: string;
      body?: unknown;
      origin?: boolean;
      headers?: Record<string, string>;
    } = {},
  ) {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.origin !== false) headers['Origin'] = SITE;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await handleWorkerRequest(
      new Request(`${SITE}${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      env,
    );
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }

  async function sessionToken(grant: ReturnType<World['repo']['auth']['redeemKey']>) {
    const result = await grant;
    if (!result.ok) throw new Error(JSON.stringify(result));
    const full = await world.repo.auth.register(result.value.token, {
      kind: 'password',
      password: PASSWORD,
      deviceName: 'Test phone',
    });
    if (!full.ok) throw new Error(JSON.stringify(full));
    return full.value.token;
  }

  async function sellerToken(sellerId: string) {
    const invite = await world.repo.auth.createKey({ role: 'seller', sellerId }, 'invite');
    tokenCounter++;
    return sessionToken(
      world.repo.auth.redeemKey(invite.key, `device-seller-${String(tokenCounter)}`),
    );
  }

  const count = async (where: string, ...params: Array<string>) =>
    (
      await world.db.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM orders WHERE ${where}`,
        ...params,
      )
    )?.n ?? 0;

  const setDemo = (slug: string, demo: boolean) =>
    call('PATCH', `/api/admin/sellers/seller-${slug}`, { token: admin, body: { demo } });

  beforeEach(async () => {
    tokenCounter = 0;
    world = await create({ now: () => new Date() });
    env = {
      DB: world.db.d1,
      IMAGES: {} as ApiEnv['IMAGES'],
      SELLER_LIVE: {} as ApiEnv['SELLER_LIVE'],
    };
    const setup = await world.repo.auth.adminSetup(DEV_ADMIN_SETUP_KEY, 'device-admin-0001');
    if (!setup.ok) throw new Error('admin setup failed');
    // The admin signs in with a passkey; the repository only stores the public half, so a stub does.
    const full = await world.repo.auth.register(setup.value.token, {
      kind: 'passkey',
      deviceName: 'Admin laptop',
      passkey: { credentialId: 'cred-admin-0001', publicKey: 'AAAA', counter: 0, transports: [] },
    });
    if (!full.ok) throw new Error('admin register failed');
    admin = full.value.token;
    sellerA = await sellerToken(A_ID);
    sellerB = await sellerToken(B_ID);
  });

  describe('the flag', () => {
    it('is off for the sample kitchens and for a new seller', async () => {
      expect((await world.repo.sellerBySlug(A))?.seller.demo).toBe(false);
      expect((await world.repo.addSeller('Kedai Baru', 'kedai-baru')).demo).toBe(false);
    });

    it('is switched by the admin and shows in the seller session, the public menu and the list', async () => {
      const on = await setDemo(A, true);
      expect(on.status).toBe(200);
      expect(parseSellerResponse(on.body)?.seller).toMatchObject({ slug: A, demo: true });
      expect(
        parseMeResponse((await call('GET', '/api/auth/me', { token: sellerA })).body)?.me.demo,
      ).toBe(true);
      expect(
        parseMeResponse((await call('GET', '/api/auth/me', { token: sellerB })).body)?.me.demo,
      ).toBe(undefined);
      const menu = (await call('GET', `/api/s/${A}/menu`)).body as { seller: { demo: boolean } };
      expect(menu.seller.demo).toBe(true);
      await setDemo(A, false);
      expect((await world.repo.adminSellers()).find((row) => row.slug === A)?.demo).toBe(false);
    });

    it('is the admin only: a seller gets 403, nobody 401, no Origin 403', async () => {
      const body = { demo: true };
      expect(
        (await call('PATCH', `/api/admin/sellers/${A_ID}`, { token: sellerA, body })).status,
      ).toBe(403);
      expect((await call('PATCH', `/api/admin/sellers/${A_ID}`, { body })).status).toBe(401);
      expect(
        (await call('PATCH', `/api/admin/sellers/${A_ID}`, { token: admin, body, origin: false }))
          .status,
      ).toBe(403);
      expect((await world.repo.sellerBySlug(A))?.seller.demo).toBe(false);
    });

    it('refuses a bad body and an unknown kitchen', async () => {
      expect(
        (await call('PATCH', `/api/admin/sellers/${A_ID}`, { token: admin, body: { demo: 'yes' } }))
          .status,
      ).toBe(400);
      expect((await setDemo('nowhere', true)).status).toBe(404);
    });
  });

  describe('sample orders', () => {
    const SAMPLES = '/api/seller/demo/samples';

    it('marks the orders the generator makes, not the ones customers place', async () => {
      const placed = await call('POST', `/api/s/${A}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      expect(placed.status).toBe(201);
      await world.repo.dev.addSampleOrders(A_ID, 5);
      expect(await count('seller_id = ? AND sample = 1', A_ID)).toBe(5);
      expect(await count('seller_id = ? AND sample = 0', A_ID)).toBe(1);
    });

    it('answers 403 for a kitchen that is not a demo one (add and clear), and changes nothing', async () => {
      for (const method of ['POST', 'DELETE']) {
        const reply = await call(method, SAMPLES, { token: sellerA });
        expect(reply.status).toBe(403);
        expect(parseApiError(reply.body)?.error).toBe('forbidden');
      }
      expect(await count('seller_id = ?', A_ID)).toBe(0);
    });

    it('needs a session: anonymous gets 401, an admin 403, a missing Origin 403', async () => {
      await setDemo(A, true);
      expect((await call('POST', SAMPLES)).status).toBe(401);
      expect((await call('DELETE', SAMPLES)).status).toBe(401);
      expect((await call('POST', SAMPLES, { token: admin })).status).toBe(403);
      expect((await call('POST', SAMPLES, { token: sellerA, origin: false })).status).toBe(403);
      expect((await call('DELETE', SAMPLES, { token: sellerA, origin: false })).status).toBe(403);
      // DEV_TOOLS is off here, so the X-Seller header is no way in either.
      expect((await call('POST', SAMPLES, { headers: { 'X-Seller': A } })).status).toBe(401);
      expect(await count('seller_id = ?', A_ID)).toBe(0);
    });

    it('adds 50 to a demo kitchen and clears them again', async () => {
      await setDemo(A, true);
      const added = await call('POST', SAMPLES, { token: sellerA });
      expect(added.status).toBe(200);
      expect(parseSampleOrdersResponse(added.body)).toEqual({ added: 50 });
      expect(await count('seller_id = ? AND sample = 1', A_ID)).toBe(50);
      // A second press adds 50 more (it must not replay the first batch's tokens).
      expect(
        parseSampleOrdersResponse((await call('POST', SAMPLES, { token: sellerA })).body)?.added,
      ).toBe(50);
      const cleared = await call('DELETE', SAMPLES, { token: sellerA });
      expect(parseClearSamplesResponse(cleared.body)).toEqual({ removed: 100 });
      expect(await count('seller_id = ?', A_ID)).toBe(0);
    });

    it('clears only sample orders of this kitchen: real orders and other kitchens stay', async () => {
      await setDemo(A, true);
      await setDemo(B, true);
      const placed = await call('POST', `/api/s/${A}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      expect(placed.status).toBe(201);
      await call('POST', SAMPLES, { token: sellerA });
      await call('POST', SAMPLES, { token: sellerB });
      expect(await call('DELETE', SAMPLES, { token: sellerA })).toMatchObject({ status: 200 });
      expect(await count('seller_id = ?', A_ID)).toBe(1);
      expect(await count('seller_id = ? AND sample = 0', A_ID)).toBe(1);
      expect(await count('seller_id = ? AND sample = 1', B_ID)).toBe(50);
      // The real order's own rows are still there; the samples' lines and audit are gone.
      const lines = await world.db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM order_lines WHERE seller_id = ?',
        A_ID,
      );
      expect(lines?.n).toBe(1);
      const audit = await world.db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM order_audit WHERE seller_id = ?',
        A_ID,
      );
      expect(audit?.n).toBeGreaterThan(0);
      // Nothing of the samples is left behind in the child tables either.
      const orphans = await world.db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM order_lines l WHERE seller_id = ? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.seller_id = l.seller_id AND o.id = l.order_id)',
        A_ID,
      );
      expect(orphans?.n).toBe(0);
    });

    it("cannot be pointed at another kitchen: a non-demo seller's X-Seller header changes nothing", async () => {
      await setDemo(A, true);
      const reply = await call('POST', SAMPLES, { token: sellerB, headers: { 'X-Seller': A } });
      expect(reply.status).toBe(403);
      expect(await count('seller_id = ?', A_ID)).toBe(0);
      await world.repo.dev.addSampleOrders(A_ID, 3);
      expect(
        (await call('DELETE', SAMPLES, { token: sellerB, headers: { 'X-Seller': A } })).status,
      ).toBe(403);
      expect(await count('seller_id = ?', A_ID)).toBe(3);
    });

    it('leaves the dev routes off in production', async () => {
      expect((await call('POST', '/api/dev/sample-orders', { body: { count: 1 } })).status).toBe(
        404,
      );
      expect((await call('POST', '/api/dev/reset')).status).toBe(404);
    });
  });
});
