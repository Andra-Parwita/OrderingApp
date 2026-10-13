// @vitest-environment node
// Plan 046, stages 1-2: maintenance mode on the server. While on, every write answers 503
// `maintenance`, reads keep working, the admin (and sign-in) are exempt; off restores everything.
// The public status shows the announcement; the release token works on its own endpoint only.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseStatus } from '../shared/maintenance';
import { DEV_ADMIN_SETUP_KEY, devApi, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const SLUG = 'onde-onde';

describe('maintenance mode (plan 046)', () => {
  const create = useWorld('maintenance');
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

  const notice = {
    from: '2026-10-11T22:00:00.000Z',
    until: '2026-10-11T22:15:00.000Z',
    noteEn: 'Database upgrade',
    noteId: 'Peningkatan basis data',
  };
  const order = () =>
    call('POST', `/api/s/${SLUG}/orders`, undefined, {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
  const patch = (admin: string, body: unknown) =>
    call('PATCH', '/api/admin/maintenance', admin, body);

  beforeEach(async () => {
    authenticator.credentials.length = 0;
    world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
  });

  it('is off by default and the public status says so', async () => {
    const reply = await call('GET', '/api/status');
    expect(reply.status).toBe(200);
    expect(parseStatus(reply.body)).toMatchObject({ maintenance: false, notice: null });
    expect((await order()).status).toBe(201);
  });

  it('refuses writes with 503 maintenance while on, keeps reads and the admin, and off restores everything', async () => {
    const admin = await adminToken();
    expect((await patch(admin, { maintenance: true })).status).toBe(200);

    const refused = await order();
    expect(refused.status).toBe(503);
    expect(errorOf(refused)).toBe('maintenance');
    expect((await call('POST', '/api/seller/menu', undefined, {})).status).toBe(503);

    expect((await call('GET', `/api/s/${SLUG}/menu`)).status).toBe(200);
    const status = parseStatus((await call('GET', '/api/status')).body);
    expect(status?.maintenance).toBe(true);
    // The admin keeps working: it can still change settings and see its list.
    expect((await call('GET', '/api/admin/sellers', admin)).status).toBe(200);

    expect((await patch(admin, { maintenance: false })).status).toBe(200);
    expect((await order()).status).toBe(201);
  });

  it('announces an update, keeps it while maintenance flips, and clears it', async () => {
    const admin = await adminToken();
    const set = await patch(admin, { notice });
    expect(set.status).toBe(200);
    await patch(admin, { maintenance: true });
    await patch(admin, { maintenance: false });
    expect(parseStatus((await call('GET', '/api/status')).body)).toMatchObject({ notice });
    await patch(admin, { notice: null });
    expect(parseStatus((await call('GET', '/api/status')).body)?.notice).toBeNull();
  });

  it('only the admin can change it, and a bad window is refused', async () => {
    expect((await patch('nope', { maintenance: true })).status).toBe(401);
    expect((await call('GET', '/api/admin/maintenance')).status).toBe(401);
    const admin = await adminToken();
    expect((await patch(admin, { notice: { ...notice, until: notice.from } })).status).toBe(400);
    expect((await patch(admin, {})).status).toBe(400);
  });

  it('the release token switches maintenance on that endpoint only', async () => {
    const send = async (
      token: string | undefined,
      path: string,
      body: unknown,
      method = 'POST',
    ) => {
      const response = await devApi(
        world.repo,
        new Request(`${SITE}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }),
        { maintenanceToken: 'release-token' },
      );
      return response?.status ?? -1;
    };
    expect(await send(undefined, '/api/maintenance', { maintenance: true })).toBe(401);
    expect(await send('wrong', '/api/maintenance', { maintenance: true })).toBe(401);
    expect(await send('release-token', '/api/maintenance', { maintenance: true })).toBe(200);
    expect(parseStatus((await call('GET', '/api/status')).body)?.maintenance).toBe(true);
    expect(await send('release-token', '/api/maintenance', { maintenance: false })).toBe(200);
    // The token is no admin session.
    expect(
      await send('release-token', '/api/admin/maintenance', { maintenance: true }, 'PATCH'),
    ).toBe(401);
    expect(parseStatus((await call('GET', '/api/status')).body)?.maintenance).toBe(false);
  });
});
