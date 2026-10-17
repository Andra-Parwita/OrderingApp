// @vitest-environment node
// Plan 086 (D-106): the admin's short message on the server. Admin only; validation; the three
// active windows; stop; filtering by kitchen, audience and expiry; and the live nudge.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveNotifier } from '../worker/live/hub';
import { DEV_ADMIN_SETUP_KEY, devApi, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';

describe('short message (plan 086)', () => {
  const create = useWorld('short-message');
  let world: World;
  let clock = new Date('2026-10-07T10:00:00Z');
  const authenticator = new SoftAuthenticator(SITE);
  const notify = vi.fn<LiveNotifier['notify']>(() => Promise.resolve());
  const live: LiveNotifier = {
    notify,
    connect: () => Promise.resolve(new Response(null)),
    connectCustomer: () => Promise.resolve(new Response(null)),
  };

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
      { live },
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

  const base = {
    textEn: 'All good now',
    textId: 'Semua beres',
    audience: 'everyone',
    window: '15m',
  };
  type Note = { id: string; textEn: string; textId: string };
  const notes = async (audience: string, kitchens = '') =>
    (
      (await call('GET', `/api/notes?audience=${audience}&kitchens=${kitchens}`)).body as {
        notes: Array<Note>;
      }
    ).notes;
  async function sellerIds(admin: string): Promise<Array<{ id: string; slug: string }>> {
    const reply = await call('GET', '/api/admin/sellers', admin);
    return (reply.body as { sellers: Array<{ id: string; slug: string }> }).sellers;
  }

  beforeEach(async () => {
    authenticator.credentials.length = 0;
    notify.mockClear();
    clock = new Date('2026-10-07T10:00:00Z');
    world = await create({ now: () => clock });
  });

  it('is admin only', async () => {
    const anonymous = await call('POST', '/api/admin/messages', undefined, {
      ...base,
      sellerIds: null,
    });
    expect(anonymous.status).toBe(401);
    expect((await call('GET', '/api/admin/messages')).status).toBe(401);
    expect((await call('DELETE', '/api/admin/messages/x')).status).toBe(401);
  });

  it('checks the input: 90 characters, text, audience, window, known kitchens', async () => {
    const admin = await adminToken();
    const send = (body: Record<string, unknown>) =>
      call('POST', '/api/admin/messages', admin, { ...base, sellerIds: null, ...body });
    expect((await send({})).status).toBe(201);
    expect((await send({ textEn: 'x'.repeat(91) })).status).toBe(400);
    expect((await send({ textEn: 'x'.repeat(90) })).status).toBe(201);
    expect((await send({ textEn: '   ' })).status).toBe(400);
    expect((await send({ textId: '' })).status).toBe(400);
    expect((await send({ textId: '', sameText: true })).status).toBe(201);
    expect((await send({ audience: 'nobody' })).status).toBe(400);
    expect((await send({ window: '2d' })).status).toBe(400);
    expect((await send({ sellerIds: [] })).status).toBe(400);
    expect((await send({ sellerIds: ['no-such-kitchen'] })).status).toBe(400);
  });

  it('same text sends one text to both languages', async () => {
    const admin = await adminToken();
    await call('POST', '/api/admin/messages', admin, {
      textEn: 'Back online',
      sameText: true,
      audience: 'everyone',
      window: '1h',
      sellerIds: null,
    });
    expect(await notes('customers')).toMatchObject([
      { textEn: 'Back online', textId: 'Back online' },
    ]);
  });

  it('computes the end: 15 minutes, 1 hour, and today until midnight in the admin zone', async () => {
    const admin = await adminToken();
    const ends = async (window: string, timeZone?: string) => {
      const reply = await call('POST', '/api/admin/messages', admin, {
        ...base,
        window,
        sellerIds: null,
        ...(timeZone ? { timeZone } : {}),
      });
      return (reply.body as { message: { expiresAt: string } }).message.expiresAt;
    };
    expect(await ends('15m')).toBe('2026-10-07T10:15:00.000Z');
    expect(await ends('1h')).toBe('2026-10-07T11:00:00.000Z');
    // 10:00 UTC is 20:30 in Adelaide (+10:30): midnight is 13:30 UTC.
    expect(await ends('today')).toBe('2026-10-07T13:30:00.000Z');
    expect(await ends('today', 'Australia/Adelaide')).toBe('2026-10-07T13:30:00.000Z');
    // The same moment is 23:00 in Auckland (+13): midnight is 11:00 UTC.
    expect(await ends('today', 'Pacific/Auckland')).toBe('2026-10-07T11:00:00.000Z');
  });

  it('gives a device only active messages for its side and kitchens; expiry and stop end it', async () => {
    const admin = await adminToken();
    const [first, second] = await sellerIds(admin);
    if (!first || !second) throw new Error('needs two kitchens');
    const post = async (body: Record<string, unknown>) =>
      (
        (await call('POST', '/api/admin/messages', admin, { ...base, sellerIds: null, ...body }))
          .body as { message: { id: string } }
      ).message.id;
    const everyone = await post({ textEn: 'to all' });
    await post({ textEn: 'sellers only', audience: 'sellers' });
    await post({ textEn: 'customers of one', audience: 'customers', sellerIds: [first.id] });

    const texts = async (audience: string, slugs = '') =>
      (await notes(audience, slugs)).map((n) => n.textEn).sort();
    expect(await texts('sellers')).toEqual(['sellers only', 'to all']);
    expect(await texts('customers')).toEqual(['to all']);
    expect(await texts('customers', first.slug)).toEqual(['customers of one', 'to all']);
    expect(await texts('customers', second.slug)).toEqual(['to all']);
    expect(await texts('customers', `${second.slug},${first.slug}`)).toEqual([
      'customers of one',
      'to all',
    ]);
    expect((await call('GET', '/api/notes?audience=bogus')).status).toBe(400);

    // Stop now: gone for new visitors at once, and the list says so.
    const stopped = await call('DELETE', `/api/admin/messages/${everyone}`, admin);
    expect(stopped.status).toBe(200);
    expect(await texts('customers')).toEqual([]);
    const listed = (await call('GET', '/api/admin/messages', admin)).body as {
      messages: Array<{ id: string; stoppedAt: string | null }>;
    };
    expect(listed.messages.find((m) => m.id === everyone)?.stoppedAt).not.toBeNull();
    expect((await call('DELETE', '/api/admin/messages/nope', admin)).status).toBe(404);

    // Fifteen minutes later nothing is active, but the list still has them.
    clock = new Date('2026-10-07T10:16:00Z');
    expect(await texts('sellers')).toEqual([]);
    const after = (await call('GET', '/api/admin/messages', admin)).body as {
      messages: Array<unknown>;
    };
    expect(after.messages).toHaveLength(3);
  });

  it('nudges the live rooms of the chosen kitchens, or of all of them', async () => {
    const admin = await adminToken();
    const kitchens = await sellerIds(admin);
    const [first] = kitchens;
    if (!first) throw new Error('needs a kitchen');
    await call('POST', '/api/admin/messages', admin, { ...base, sellerIds: [first.id] });
    expect(notify.mock.calls).toEqual([[first.id, { type: 'notice' }]]);
    notify.mockClear();
    await call('POST', '/api/admin/messages', admin, { ...base, sellerIds: null });
    expect(notify.mock.calls.map(([id]) => id).sort()).toEqual(kitchens.map((k) => k.id).sort());
  });
});
