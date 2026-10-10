// @vitest-environment node
// Stage 8.4a: every dev-only path answers as if it did not exist unless the Worker var
// DEV_TOOLS is "1" (set only in .dev.vars). Absent is how production runs.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseHealth } from '../shared/health';
import { LIVE_PATH } from '../shared/liveContract';
import { devToolsOn, handleWorkerRequest, type ApiEnv } from '../worker/api';
import { handleApiRequest } from '../worker/api/routes';
import { useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const SITE = 'https://delave.test';

function req(method: string, path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${SITE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: SITE, ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify({ count: 1 }) }),
  });
}

describe('dev tools flag', () => {
  const create = useWorld('devTools');
  let world: World;
  beforeEach(async () => {
    world = await create({ now: () => NOW });
  });

  const DEV_ROUTES = [
    ['GET', '/api/dev/sellers'],
    ['POST', '/api/dev/sample-orders'],
    ['POST', '/api/dev/reset'],
  ] as const;

  describe.each([
    ['absent', {}],
    ['false', { devTools: false }],
  ])('flag %s', (_label, context) => {
    it.each(DEV_ROUTES)('%s %s finds no route', async (method, path) => {
      expect(await handleApiRequest(world.repo, req(method, path), context)).toBeNull();
    });

    it('does not reset the database', async () => {
      await handleApiRequest(world.repo, req('POST', '/api/dev/reset'), context);
      expect(await world.repo.listSellers()).toHaveLength(2);
    });

    it('ignores the X-Seller / X-Actor override on seller routes (401)', async () => {
      const reply = await handleApiRequest(
        world.repo,
        req('GET', '/api/seller/orders', { 'X-Seller': 'onde-onde', 'X-Actor': 'seller:Bu Ani' }),
        context,
      );
      expect(reply?.status).toBe(401);
    });

    it('has no live-socket slug fallback (401)', async () => {
      const upgrade = { Upgrade: 'websocket' };
      const live = {
        notify: () => Promise.resolve(),
        connect: () => Promise.resolve(new Response()),
      };
      const byHeader = await handleApiRequest(
        world.repo,
        req('GET', LIVE_PATH, { ...upgrade, 'X-Seller': 'onde-onde' }),
        { ...context, live },
      );
      expect(byHeader?.status).toBe(401);
      const bySlug = await handleApiRequest(
        world.repo,
        req('GET', `${LIVE_PATH}?seller=onde-onde`, upgrade),
        {
          ...context,
          live,
        },
      );
      expect(bySlug?.status).toBe(401);
    });
  });

  it('the same routes work with the flag on', async () => {
    const context = { devTools: true };
    const sellers = await handleApiRequest(world.repo, req('GET', '/api/dev/sellers'), context);
    expect(sellers?.status).toBe(200);
    const seller = await handleApiRequest(
      world.repo,
      req('GET', '/api/seller/orders', { 'X-Seller': 'onde-onde' }),
      context,
    );
    expect(seller?.status).toBe(200);
  });

  it('only "1" turns the flag on', () => {
    expect(devToolsOn({})).toBe(false);
    expect(devToolsOn({ DEV_TOOLS: '' })).toBe(false);
    expect(devToolsOn({ DEV_TOOLS: 'true' })).toBe(false);
    expect(devToolsOn({ DEV_TOOLS: '0' })).toBe(false);
    expect(devToolsOn({ DEV_TOOLS: '1' })).toBe(true);
  });

  it('the Worker answers 404 for dev routes and reports devTools in /api/health', async () => {
    const env = (flag?: string): ApiEnv => ({
      DB: world.db.d1,
      IMAGES: {} as ApiEnv['IMAGES'],
      SELLER_LIVE: {} as ApiEnv['SELLER_LIVE'],
      ...(flag === undefined ? {} : { DEV_TOOLS: flag }),
    });
    expect((await handleWorkerRequest(req('GET', '/api/dev/sellers'), env())).status).toBe(404);
    expect((await handleWorkerRequest(req('POST', '/api/dev/reset'), env())).status).toBe(404);
    expect((await handleWorkerRequest(req('GET', '/api/dev/sellers'), env('1'))).status).toBe(200);
    const off = parseHealth(
      await (await handleWorkerRequest(req('GET', '/api/health'), env())).json(),
    );
    const on = parseHealth(
      await (await handleWorkerRequest(req('GET', '/api/health'), env('1'))).json(),
    );
    expect(off?.version).toBe('dev'); // no build define under vitest
    expect(off?.devTools).toBe(false);
    expect(on?.devTools).toBe(true);
  });

  it('an absent ADMIN_SETUP_KEY lets nobody set up the admin', async () => {
    const env: ApiEnv = {
      DB: world.db.d1,
      IMAGES: {} as ApiEnv['IMAGES'],
      SELLER_LIVE: {} as ApiEnv['SELLER_LIVE'],
    };
    const setup = new Request(`${SITE}/api/admin/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE },
      body: JSON.stringify({ setupKey: 'DLV-DEVA-DMIN-SETU-PKEY', deviceId: 'dev-1-abcd-efgh' }),
    });
    expect((await handleWorkerRequest(setup, env)).status).toBeGreaterThanOrEqual(400);
  });
});
