// @vitest-environment node
// Plan 087 stage 1 ("Remember me", customers): the optional customer passkey on the server.
// Register and sign in with a software authenticator, single-use challenges, code adoption with
// proof, per-kitchen codes, the 6-digit "add this phone" code and its limits, the address rules,
// delete-everything, and above all the separation from the sellers' side.
import { beforeEach, describe, expect, it } from 'vitest';
import { shortCustomerCode } from '../shared/customerCode';
import { stripPrf } from '../shared/customerContract';
import { LIVE_PATH } from '../shared/liveContract';
import { parseCustomerOrderResponse } from '../shared/orderContract';
import { handleApiRequest } from '../worker/api/routes';
import { sweepCustomerHourly, sweepCustomerWeekly } from '../worker/db/customerAuth';
import type { LiveNotifier } from '../worker/live/hub';
import { DEV_ADMIN_SETUP_KEY, useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const SLUG = 'onde-onde';
const OTHER_SLUG = 'dapur-demo';
const START = Date.parse('2026-10-07T10:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const OTHER_CODE = 'ffffffffffffffffffffffff';
const PHONE_A = 'phone-aaaa-0001';
const PHONE_B = 'phone-bbbb-0002';
const SEALED = { v: 1, iv: 'aGVsbG8taXY', ct: 'c2VhbGVkLWFkZHJlc3M' };
const CUSTOMER_TABLES = [
  'customer_accounts',
  'customer_passkeys',
  'customer_sessions',
  'customer_challenges',
  'customer_phone_codes',
  'customer_order_links',
  'customer_kitchen_codes',
  'customer_sealed_addresses',
];

describe('Remember me (plan 087), server', () => {
  const create = useWorld('remember-me');
  let world: World;
  let now = START;
  let tokens = 0;
  const live: LiveNotifier = {
    notify: () => Promise.resolve(),
    connect: () => Promise.resolve(new Response(null)),
    connectCustomer: () => Promise.resolve(new Response(null)),
  };

  type Reply = { status: number; body: unknown; text: string; setCookie: string };
  async function call(
    method: string,
    path: string,
    options: {
      customer?: string;
      session?: string;
      body?: unknown;
      ip?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = { ...options.headers };
    const cookies = [
      ...(options.customer ? [`__Host-customer=${options.customer}`] : []),
      ...(options.session ? [`__Host-session=${options.session}`] : []),
    ];
    if (cookies.length > 0) headers['Cookie'] = cookies.join('; ');
    if (options.ip) headers['CF-Connecting-IP'] = options.ip;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    // Not the dev routes: a production Worker, where a request without a session is refused.
    const response = await handleApiRequest(
      world.repo,
      new Request(`${SITE}${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      { live },
    );
    const text = (await response?.text()) ?? '';
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON
    }
    return {
      status: response?.status ?? -1,
      body,
      text,
      setCookie: response?.headers.get('set-cookie') ?? '',
    };
  }
  const customerCookie = (reply: Reply) =>
    /__Host-customer=([^;]+)/.exec(reply.setCookie)?.[1] ?? '';
  const errorOf = (reply: Reply) => (reply.body as { error?: string }).error;
  type Me = {
    firstName: string;
    credentialId: string | null;
    prf: boolean;
    setup: boolean;
    sealed: unknown;
    customerCode?: string;
    code?: string;
  };
  const meOf = (reply: Reply) => (reply.body as { me: Me }).me;

  async function place(slug = SLUG, customerCode?: string) {
    const reply = await call('POST', `/api/s/${slug}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: slug === SLUG ? 'pesmol' : 'soto-ayam', qty: 1 }],
        ...(customerCode !== undefined ? { customerCode } : {}),
      },
    });
    const parsed = parseCustomerOrderResponse(reply.body);
    if (reply.status !== 201 || !parsed) throw new Error(`not placed: ${reply.text}`);
    return parsed.order.token;
  }

  type RegisterExtra = {
    tokens?: Array<string>;
    adopt?: Array<{ slug: string; code: string; token: string }>;
    firstName?: string;
    prf?: boolean;
    tweak?: (response: Record<string, unknown>) => void;
  };
  async function register(
    phone: SoftAuthenticator,
    deviceId = PHONE_A,
    extra: RegisterExtra = {},
  ): Promise<Reply> {
    const asked = await call('POST', '/api/customer/register/options', {
      body: { deviceId, ...(extra.firstName ? { firstName: extra.firstName } : {}) },
    });
    expect(asked.status).toBe(200);
    const options = (asked.body as { options: Record<string, unknown> }).options;
    const response = phone.create(options as never);
    extra.tweak?.(response);
    return call('POST', '/api/customer/register', {
      body: {
        deviceId,
        response,
        tokens: extra.tokens ?? [],
        adopt: extra.adopt ?? [],
        prf: extra.prf ?? false,
        ...(extra.firstName ? { firstName: extra.firstName } : {}),
      },
    });
  }
  async function signInAnswer(phone: SoftAuthenticator, deviceId: string) {
    const asked = await call('POST', '/api/customer/passkey/options', { body: { deviceId } });
    expect(asked.status).toBe(200);
    return phone.get((asked.body as { options: Record<string, unknown> }).options as never);
  }
  async function signIn(phone: SoftAuthenticator, deviceId: string): Promise<Reply> {
    return call('POST', '/api/customer/passkey', {
      body: { deviceId, response: await signInAnswer(phone, deviceId) },
    });
  }
  /** A registered customer: the phone, the cookie and the register reply. */
  async function customer(extra: RegisterExtra = {}) {
    const phone = new SoftAuthenticator(SITE);
    const reply = await register(phone, PHONE_A, { firstName: 'Rina', ...extra });
    expect(reply.status).toBe(201);
    return { phone, cookie: customerCookie(reply), reply };
  }
  const count = async (table: string) =>
    (await world.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? -1;

  async function adminPasskey(): Promise<{ phone: SoftAuthenticator; token: string }> {
    const phone = new SoftAuthenticator(SITE);
    const setup = await call('POST', '/api/admin/setup', {
      body: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: 'device-aaaa-0001' },
    });
    const token = /__Host-session=([^;]+)/.exec(setup.setCookie)?.[1] ?? '';
    const asked = await call('POST', '/api/auth/register/options', { session: token });
    const done = await call('POST', '/api/auth/register', {
      session: token,
      body: {
        kind: 'passkey',
        deviceName: 'Laptop',
        response: phone.create(
          (asked.body as { options: Record<string, unknown> }).options as never,
        ),
      },
    });
    expect(done.status).toBe(201);
    return { phone, token: /__Host-session=([^;]+)/.exec(done.setCookie)?.[1] ?? '' };
  }

  beforeEach(async () => {
    now = START;
    tokens = 0;
    world = await create({
      now: () => new Date(now),
      newToken: () => `order-token-${String(++tokens).padStart(4, '0')}`,
    });
  });

  it('registers with a passkey, keeps the order list, and signs in again', async () => {
    const t1 = await place();
    const t2 = await place(OTHER_SLUG);
    const phone = new SoftAuthenticator(SITE);
    const asked = await call('POST', '/api/customer/register/options', {
      body: { deviceId: PHONE_A, firstName: 'Rina' },
    });
    const options = (asked.body as { options: { user: { displayName: string } } }).options;
    expect(options.user.displayName).toBe('Rina · Remember me');
    const done = await register(phone, PHONE_A, {
      firstName: 'Rina',
      prf: true,
      tokens: [t1, t2, 'unknown-token-0000000000'],
    });
    expect(done.status).toBe(201);
    expect(done.setCookie).toContain('__Host-customer=');
    expect(done.setCookie).toContain('HttpOnly');
    expect(done.setCookie).toContain('Secure');
    expect(done.text).not.toContain(customerCookie(done)); // the token is in the header only
    expect(meOf(done)).toMatchObject({ firstName: 'Rina', prf: true, setup: false, sealed: null });
    const cookie = customerCookie(done);

    const orders = await call('GET', '/api/customer/orders', { customer: cookie });
    const list = (orders.body as { orders: Array<{ token: string; slug: string }> }).orders;
    expect(list).toHaveLength(2); // the unknown token was dropped
    expect(list.map((o) => o.slug).sort()).toEqual([OTHER_SLUG, SLUG]);

    // A new browser: signed out, then in again with the passkey.
    expect((await call('POST', '/api/customer/sign-out', { customer: cookie })).status).toBe(200);
    expect((await call('GET', '/api/customer/me', { customer: cookie })).status).toBe(401);
    const again = await signIn(phone, PHONE_B);
    expect(again.status).toBe(200);
    expect(meOf(again).firstName).toBe('Rina');
    const second = await signIn(phone, PHONE_B); // counter went up, still fine
    expect(second.status).toBe(200);
    expect(
      (await call('GET', '/api/customer/orders', { customer: customerCookie(second) })).status,
    ).toBe(200);
    const patched = await call('PATCH', '/api/customer/me', {
      customer: customerCookie(second),
      body: { firstName: 'Rin' },
    });
    expect(meOf(patched).firstName).toBe('Rin');
  });

  it('a registration answer or a sign-in answer works once (the challenge is single use)', async () => {
    const phone = new SoftAuthenticator(SITE);
    const asked = await call('POST', '/api/customer/register/options', {
      body: { deviceId: PHONE_A },
    });
    const response = phone.create(
      (asked.body as { options: Record<string, unknown> }).options as never,
    );
    const body = { deviceId: PHONE_A, response, tokens: [], adopt: [], prf: false };
    expect((await call('POST', '/api/customer/register', { body })).status).toBe(201);
    expect((await call('POST', '/api/customer/register', { body })).status).toBe(400);

    const answer = await signInAnswer(phone, PHONE_B);
    const signed = { deviceId: PHONE_B, response: answer };
    expect((await call('POST', '/api/customer/passkey', { body: signed })).status).toBe(200);
    const replay = await call('POST', '/api/customer/passkey', { body: signed });
    expect(replay.status).toBe(401);
    expect(errorOf(replay)).toBe('invalid_credentials');
    // An answer for another phone's challenge is refused as well.
    const other = await signInAnswer(phone, PHONE_B);
    expect(
      (
        await call('POST', '/api/customer/passkey', {
          body: { deviceId: PHONE_A, response: other },
        })
      ).status,
    ).toBe(401);
  });

  it('adopts a plan 071 code only with proof; every kitchen gets its own stable code', async () => {
    const token = await place(SLUG, CODE);
    const stranger = await place(SLUG, OTHER_CODE);
    const { cookie } = await customer({
      tokens: [token],
      adopt: [
        { slug: SLUG, code: CODE, token }, // proof: this order has this code at this kitchen
        { slug: OTHER_SLUG, code: CODE, token }, // wrong kitchen
        { slug: SLUG, code: OTHER_CODE, token }, // a code the order never carried
      ],
    });
    const mine = meOf(await call('GET', `/api/customer/me?slug=${SLUG}`, { customer: cookie }));
    expect(mine.customerCode).toBe(CODE);
    expect(mine.code).toBe(shortCustomerCode(CODE));

    // Nobody can take over a code they only know (the order is somebody else's, a code of another).
    const thief = await customer({ adopt: [{ slug: SLUG, code: OTHER_CODE, token }] });
    const stolen = meOf(
      await call('GET', `/api/customer/me?slug=${SLUG}`, { customer: thief.cookie }),
    );
    expect(stolen.customerCode).not.toBe(OTHER_CODE);
    expect(stranger).not.toBe(token);

    // Without adoption the code is derived: stable, differs across kitchens and across customers.
    const fresh = await customer();
    const a1 = meOf(await call('GET', `/api/customer/me?slug=${SLUG}`, { customer: fresh.cookie }));
    const a2 = meOf(await call('GET', `/api/customer/me?slug=${SLUG}`, { customer: fresh.cookie }));
    const b1 = meOf(
      await call('GET', `/api/customer/me?slug=${OTHER_SLUG}`, { customer: fresh.cookie }),
    );
    expect(a1.customerCode).toMatch(/^[a-f0-9]{24}$/);
    expect(a1.customerCode).toBe(a2.customerCode);
    expect(a1.customerCode).not.toBe(b1.customerCode);
    expect(a1.code).toMatch(/^C-[0-9A-HJKMNP-TV-Z]{4}$/);
    const second = await call('POST', '/api/customer/sign-out', { customer: fresh.cookie });
    expect(second.status).toBe(200);
    const again = meOf(
      await call('GET', `/api/customer/me?slug=${SLUG}`, {
        customer: customerCookie(await signIn(fresh.phone, PHONE_B)),
      }),
    );
    expect(again.customerCode).toBe(a1.customerCode); // the same on another phone
    const other = await customer();
    const otherCode = meOf(
      await call('GET', `/api/customer/me?slug=${SLUG}`, { customer: other.cookie }),
    );
    expect(otherCode.customerCode).not.toBe(a1.customerCode);
  });

  it('a new phone joins with a 6-digit code, then adds its own passkey', async () => {
    const { cookie } = await customer({ tokens: [await place()] });
    const made = await call('POST', '/api/customer/phone-codes', { customer: cookie });
    expect(made.status).toBe(201);
    const { code } = made.body as { code: string };
    expect(code).toMatch(/^\d{6}$/);

    const joined = await call('POST', '/api/customer/code', { body: { deviceId: PHONE_B, code } });
    expect(joined.status).toBe(200);
    const joinCookie = customerCookie(joined);
    expect(meOf(joined)).toMatchObject({ setup: true, credentialId: null });
    // A joining phone can do nothing but add its passkey.
    expect((await call('GET', '/api/customer/orders', { customer: joinCookie })).status).toBe(401);
    expect(
      (await call('PUT', '/api/customer/address', { customer: joinCookie, body: SEALED })).status,
    ).toBe(401);
    // The code is single use.
    const reused = await call('POST', '/api/customer/code', {
      body: { deviceId: 'phone-cccc-0003', code },
    });
    expect(reused.status).toBe(401);

    const newPhone = new SoftAuthenticator(SITE);
    const asked = await call('POST', '/api/customer/passkeys/options', { customer: joinCookie });
    expect(asked.status).toBe(200);
    const options = (asked.body as { options: Record<string, unknown> }).options;
    const added = await call('POST', '/api/customer/passkeys', {
      customer: joinCookie,
      body: { response: newPhone.create(options as never), prf: true },
    });
    expect(added.status).toBe(200);
    expect(meOf(added)).toMatchObject({ setup: false, prf: true, firstName: 'Rina' });
    expect(customerCookie(added)).toBe(joinCookie);
    expect((await call('GET', '/api/customer/orders', { customer: joinCookie })).status).toBe(200);
    // And it signs in by itself later.
    expect((await signIn(newPhone, 'phone-dddd-0004')).status).toBe(200);
    // A challenge made for registering is not good for adding.
    const fresh = new SoftAuthenticator(SITE);
    const register = await call('POST', '/api/customer/register/options', {
      body: { deviceId: PHONE_A },
    });
    const wrong = await call('POST', '/api/customer/passkeys', {
      customer: joinCookie,
      body: {
        response: fresh.create(
          (register.body as { options: Record<string, unknown> }).options as never,
        ),
      },
    });
    expect(wrong.status).toBe(400);
  });

  it('a code expires after 5 minutes', async () => {
    const { cookie } = await customer();
    const { code } = (await call('POST', '/api/customer/phone-codes', { customer: cookie }))
      .body as { code: string };
    now += 5 * MIN + 1000;
    expect(
      (await call('POST', '/api/customer/code', { body: { deviceId: PHONE_B, code } })).status,
    ).toBe(401);
  });

  it('6-digit code limits: 5 wrong per phone, 5 per network, and a breaker over 50', async () => {
    const { cookie } = await customer();
    const { code } = (await call('POST', '/api/customer/phone-codes', { customer: cookie }))
      .body as { code: string };
    const wrongCode = code === '000000' ? '111111' : '000000';
    const wrong = (deviceId: string, ip?: string, tried = wrongCode) =>
      call('POST', '/api/customer/code', {
        body: { deviceId, code: tried },
        ...(ip ? { ip } : {}),
      });

    // Per phone: the 5th wrong try locks, and then even the right code is refused.
    for (let i = 1; i <= 4; i++) expect((await wrong(PHONE_B)).status).toBe(401);
    const fifth = await wrong(PHONE_B);
    expect(fifth.status).toBe(429);
    expect(errorOf(fifth)).toBe('locked_out');
    expect((await wrong(PHONE_B, undefined, code)).status).toBe(429);

    // Per network: new phones, one address.
    for (let i = 1; i <= 4; i++)
      expect((await wrong(`phone-net-000${i}`, '203.0.113.9')).status).toBe(401);
    expect((await wrong('phone-net-0005', '203.0.113.9')).status).toBe(429);
    expect((await wrong('phone-net-0006', '203.0.113.9', code)).status).toBe(429);

    // Many phones and addresses: the 51st wrong try anywhere cancels every live code.
    const used = async () =>
      (await world.db.first<{ used: number }>('SELECT used FROM customer_phone_codes'))?.used;
    // 10 wrong tries are counted so far (5 per phone, 5 per network); 40 more make 50.
    for (let i = 0; i < 40; i++) {
      await wrong(`phone-many-${String(i).padStart(4, '0')}`, `198.51.100.${String(i + 1)}`);
    }
    expect(await used()).toBe(0);
    await wrong('phone-many-9999', '198.51.100.201');
    expect(await used()).toBe(1);
    const late = await call('POST', '/api/customer/code', {
      body: { deviceId: 'phone-late-0001', code },
      ip: '192.0.2.77',
    });
    expect(late.status).toBe(401);
  });

  it('delete my data removes everything of the customer at once', async () => {
    const t1 = await place(SLUG, CODE);
    const { phone, cookie } = await customer({
      tokens: [t1],
      adopt: [{ slug: SLUG, code: CODE, token: t1 }],
    });
    await call('PUT', '/api/customer/address', { customer: cookie, body: SEALED });
    await call('POST', '/api/customer/phone-codes', { customer: cookie });
    await call('POST', '/api/customer/passkeys/options', { customer: cookie });
    // Someone else's data stays.
    const bystander = await customer({ tokens: [await place()] });
    const linksBefore = await count('customer_order_links');
    expect(linksBefore).toBe(2);

    const gone = await call('DELETE', '/api/customer/me', { customer: cookie });
    expect(gone.status).toBe(200);
    expect(gone.setCookie).toContain('Max-Age=0');
    expect((await call('GET', '/api/customer/me', { customer: cookie })).status).toBe(401);
    expect((await signIn(phone, PHONE_B)).status).toBe(401); // the passkey is useless now
    expect(await count('customer_accounts')).toBe(1);
    expect(await count('customer_passkeys')).toBe(1);
    expect(await count('customer_order_links')).toBe(1);
    expect(await count('customer_kitchen_codes')).toBe(0);
    expect(await count('customer_sealed_addresses')).toBe(0);
    expect(await count('customer_phone_codes')).toBe(0);
    expect((await call('GET', '/api/customer/me', { customer: bystander.cookie })).status).toBe(
      200,
    );
    await call('DELETE', '/api/customer/me', { customer: bystander.cookie });
    for (const table of CUSTOMER_TABLES) {
      if (table !== 'customer_challenges') expect(await count(table)).toBe(0);
    }
  });

  it('a customer cookie reaches nothing on the sellers side (seller, admin, live), and back', async () => {
    const admin = await adminPasskey();
    const { cookie } = await customer({ tokens: [await place()] });

    expect((await call('GET', '/api/seller/orders', { customer: cookie })).status).toBe(401);
    expect((await call('GET', '/api/seller/menu', { customer: cookie })).status).toBe(401);
    expect((await call('GET', '/api/auth/me', { customer: cookie })).status).toBe(401);
    expect((await call('GET', '/api/auth/memberships', { customer: cookie })).status).toBe(401);
    expect((await call('GET', '/api/auth/devices', { customer: cookie })).status).toBe(401);
    expect((await call('GET', '/api/admin/sellers', { customer: cookie })).status).toBe(401);
    expect((await call('GET', '/api/admin/messages', { customer: cookie })).status).toBe(401);
    expect(
      (await call('POST', '/api/auth/device-codes', { customer: cookie, body: {} })).status,
    ).toBe(401);
    const socket = await call('GET', LIVE_PATH, {
      customer: cookie,
      headers: { Upgrade: 'websocket' },
    });
    expect(socket.status).toBe(401);

    // The sellers' session is not a customer session either.
    expect((await call('GET', '/api/customer/me', { session: admin.token })).status).toBe(401);
    expect((await call('GET', '/api/customer/orders', { session: admin.token })).status).toBe(401);
    // ...and with both cookies each side sees only its own.
    expect(
      (await call('GET', '/api/auth/me', { customer: cookie, session: admin.token })).status,
    ).toBe(200);
    expect(
      (await call('GET', '/api/customer/me', { customer: cookie, session: admin.token })).status,
    ).toBe(200);
  });

  it('a customer passkey is refused at kitchen sign-in with a friendly error, and the other way', async () => {
    const admin = await adminPasskey();
    const { phone } = await customer();

    // Remember me passkey at the kitchen sign-in.
    const asked = await call('POST', '/api/auth/passkey/options', { body: { deviceId: PHONE_B } });
    const answer = phone.get((asked.body as { options: Record<string, unknown> }).options as never);
    const atKitchen = await call('POST', '/api/auth/passkey', {
      body: { deviceId: PHONE_B, response: answer },
    });
    expect(atKitchen.status).toBe(409);
    expect(errorOf(atKitchen)).toBe('passkey_other_kind');
    const optionsFor = await call('POST', '/api/auth/passkey/options', {
      body: { deviceId: PHONE_B, credentialId: answer['id'] },
    });
    expect(errorOf(optionsFor)).toBe('passkey_other_kind');

    // A kitchen passkey at the customer sign-in.
    const askedC = await call('POST', '/api/customer/passkey/options', {
      body: { deviceId: PHONE_B },
    });
    const kitchenAnswer = admin.phone.get(
      (askedC.body as { options: Record<string, unknown> }).options as never,
    );
    const atCustomer = await call('POST', '/api/customer/passkey', {
      body: { deviceId: PHONE_B, response: kitchenAnswer },
    });
    expect(atCustomer.status).toBe(409);
    expect(errorOf(atCustomer)).toBe('passkey_other_kind');
    expect(
      errorOf(
        await call('POST', '/api/customer/passkey/options', {
          body: { deviceId: PHONE_B, credentialId: kitchenAnswer['id'] },
        }),
      ),
    ).toBe('passkey_other_kind');
    // Neither refusal counted as a wrong try: the right passkeys still sign in.
    expect((await signIn(phone, PHONE_B)).status).toBe(200);
  });

  it('the sealed address: 30 days from the last confirmed order, ciphertext only, per passkey', async () => {
    const { phone, cookie } = await customer();
    expect((await call('GET', '/api/customer/address', { customer: cookie })).body).toEqual({
      sealed: null,
    });
    const put = await call('PUT', '/api/customer/address', { customer: cookie, body: SEALED });
    expect(put.status).toBe(200); // a new account: 30 days from creation
    expect((await call('GET', '/api/customer/address', { customer: cookie })).body).toEqual({
      sealed: SEALED,
    });
    expect(meOf(await call('GET', '/api/customer/me', { customer: cookie })).sealed).toEqual(
      SEALED,
    );
    // Bad blobs are refused.
    const big = { ...SEALED, ct: 'A'.repeat(2049) };
    expect(
      (await call('PUT', '/api/customer/address', { customer: cookie, body: big })).status,
    ).toBe(400);
    expect(
      (
        await call('PUT', '/api/customer/address', {
          customer: cookie,
          body: { ...SEALED, ct: 'not base64!' },
        })
      ).status,
    ).toBe(400);

    // 31 days on, with no order: no new address, and the old one goes with the hourly sweep.
    now += 31 * DAY;
    const refused = await call('PUT', '/api/customer/address', { customer: cookie, body: SEALED });
    expect(refused.status).toBe(409);
    expect(errorOf(refused)).toBe('no_recent_order');
    expect((await sweepCustomerHourly(world.db, new Date(now))).addresses).toBe(1);
    expect((await call('GET', '/api/customer/address', { customer: cookie })).body).toEqual({
      sealed: null,
    });
    // A confirmed order makes it possible again.
    await world.db
      .stmt('UPDATE customer_accounts SET last_order_at = ?', new Date(now - DAY).toISOString())
      .run();
    expect(
      (await call('PUT', '/api/customer/address', { customer: cookie, body: SEALED })).status,
    ).toBe(200);
    // Another passkey of the same customer has its own blob (it cannot open this one).
    const second = new SoftAuthenticator(SITE);
    const options = await call('POST', '/api/customer/passkeys/options', { customer: cookie });
    const added = await call('POST', '/api/customer/passkeys', {
      customer: cookie,
      body: {
        response: second.create(
          (options.body as { options: Record<string, unknown> }).options as never,
        ),
      },
    });
    expect(added.status).toBe(200);
    expect((await call('GET', '/api/customer/address', { customer: cookie })).body).toEqual({
      sealed: null,
    });
    expect(phone.credentials).toHaveLength(1);
    expect((await call('DELETE', '/api/customer/address', { customer: cookie })).status).toBe(200);
  });

  it('retention: idle accounts after 12 months, links whose order is gone, expired sessions', async () => {
    const t1 = await place();
    const t2 = await place(OTHER_SLUG);
    const { cookie } = await customer({ tokens: [t1, t2] });
    const idle = await customer({ tokens: [await place()] });
    await world.db.stmt('DELETE FROM orders WHERE token = ?', t1).run();
    const weekly = await sweepCustomerWeekly(world.db, new Date(now));
    expect(weekly).toEqual({ accounts: 0, links: 1 });
    expect(
      (
        (await call('GET', '/api/customer/orders', { customer: cookie })).body as {
          orders: Array<unknown>;
        }
      ).orders,
    ).toHaveLength(1);

    // A year passes; one customer used it in the last weeks, the other did not.
    now += 366 * DAY;
    await world.db
      .stmt(
        'UPDATE customer_accounts SET last_used_at = ? WHERE id = (SELECT account_id FROM customer_order_links WHERE token = ?)',
        new Date(now - 7 * DAY).toISOString(),
        t2,
      )
      .run();
    expect(await sweepCustomerWeekly(world.db, new Date(now))).toMatchObject({ accounts: 1 });
    expect(await count('customer_accounts')).toBe(1);
    expect((await call('GET', '/api/customer/me', { customer: idle.cookie })).status).toBe(401);
    now += 100 * DAY;
    await sweepCustomerHourly(world.db, new Date(now));
    expect(await count('customer_sessions')).toBe(0);
  });

  it('merging keeps the newest 200 links; unknown tokens are dropped', async () => {
    const { cookie } = await customer();
    const id = (await world.db.first<{ id: string }>('SELECT id FROM customer_accounts'))?.id ?? '';
    const sellerId = 'seller-onde-onde';
    const rows = Array.from({ length: 200 }, (_, i) => [
      id,
      `old-link-${String(i).padStart(6, '0')}`,
      sellerId,
      new Date(START - (i + 1) * MIN).toISOString(),
    ]);
    for (const row of rows) {
      await world.db
        .stmt(
          'INSERT INTO customer_order_links (account_id, token, seller_id, created_at) VALUES (?, ?, ?, ?)',
          ...(row as [string, string, string, string]),
        )
        .run();
    }
    const fresh = await place();
    const merged = await call('POST', '/api/customer/orders', {
      customer: cookie,
      body: { tokens: [fresh, 'unknown-token-0000000000'] },
    });
    const list = (merged.body as { orders: Array<{ token: string }> }).orders;
    expect(list).toHaveLength(200);
    expect(list[0]?.token).toBe(fresh);
    expect(await count('customer_order_links')).toBe(200);
    // Too many tokens, or a bad one, is a plain 400.
    expect(
      (await call('POST', '/api/customer/orders', { customer: cookie, body: { tokens: ['x'] } }))
        .status,
    ).toBe(400);
  });

  it('never stores or returns a passkey PRF output', async () => {
    const SECRET = 'SECRET-PRF-OUTPUT-1234567890';
    const reply = await register(new SoftAuthenticator(SITE), PHONE_A, {
      prf: true,
      tweak: (response) => {
        response['clientExtensionResults'] = {
          prf: { enabled: true, results: { first: SECRET } },
          credProps: { rk: true },
        };
      },
    });
    expect(reply.status).toBe(201);
    expect(reply.text).not.toContain(SECRET);
    const dump: Array<unknown> = [];
    for (const table of CUSTOMER_TABLES) dump.push(await world.db.all(`SELECT * FROM ${table}`));
    expect(JSON.stringify(dump)).not.toContain(SECRET);
    // The parser drops it before any route code sees it; other extension results stay.
    const stripped = stripPrf({
      id: 'x',
      clientExtensionResults: { prf: { results: { first: SECRET } }, credProps: { rk: true } },
    });
    expect(JSON.stringify(stripped)).not.toContain(SECRET);
    expect(stripped['clientExtensionResults']).toEqual({ credProps: { rk: true } });
  });

  it('rate limits customer sign-in calls per browser id', async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (await call('POST', '/api/customer/passkey/options', { body: { deviceId: PHONE_A } }))
        .status;
    }
    expect(last).toBe(429);
    expect(
      (await call('POST', '/api/customer/passkey/options', { body: { deviceId: PHONE_B } })).status,
    ).toBe(200);
  });

  it('refuses malformed requests plainly', async () => {
    expect((await call('POST', '/api/customer/register/options', { body: {} })).status).toBe(400);
    expect(
      (await call('POST', '/api/customer/register', { body: { deviceId: PHONE_A, response: 'x' } }))
        .status,
    ).toBe(400);
    expect(
      (await call('POST', '/api/customer/code', { body: { deviceId: PHONE_A, code: '12' } }))
        .status,
    ).toBe(400);
    expect((await call('GET', '/api/customer/orders')).status).toBe(401);
    expect((await call('DELETE', '/api/customer/me')).status).toBe(401);
  });
});
