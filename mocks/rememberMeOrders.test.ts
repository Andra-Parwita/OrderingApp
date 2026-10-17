// @vitest-environment node
// Plan 087 stage 2 ("Remember me"): confirmed orders, the per-kitchen code and the retention key.
// Register and sign in with a software authenticator, single-use challenges, code adoption with
// proof, per-kitchen codes, the 6-digit "add this phone" code and its limits, the address rules,
// delete-everything, and above all the separation from the sellers' side.
import { beforeEach, describe, expect, it } from 'vitest';
import { shortCustomerCode } from '../shared/customerCode';
import { parseCustomerOrderResponse } from '../shared/orderContract';
import { parseBackupFile } from '../shared/backup';
import type { SellerRepository } from '../worker/repo/Repository';
import { handleApiRequest } from '../worker/api/routes';
import { sweepCustomerHourly } from '../worker/db/customerAuth';
import type { LiveNotifier } from '../worker/live/hub';
import { useWorld, type World } from './impl';
import { SoftAuthenticator } from './softAuthenticator';

const SITE = 'https://delave.test';
const SLUG = 'onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const PHONE_A = 'phone-aaaa-0001';
const PHONE_B = 'phone-bbbb-0002';
const SEALED = { v: 1, iv: 'aGVsbG8taXY', ct: 'c2VhbGVkLWFkZHJlc3M' };

describe('Remember me (plan 087), confirmed orders', () => {
  const create = useWorld('remember-me-orders');
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
  type Me = {
    firstName: string;
    credentialId: string | null;
    prf: boolean;
    setup: boolean;
    sealed: unknown;
    customerCode?: string;
    code?: string;
  };

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
  /** A registered customer: the phone, the cookie and the register reply. */
  async function customer(extra: RegisterExtra = {}) {
    const phone = new SoftAuthenticator(SITE);
    const reply = await register(phone, PHONE_A, { firstName: 'Rina', ...extra });
    expect(reply.status).toBe(201);
    return { phone, cookie: customerCookie(reply), reply };
  }
  const count = async (table: string) =>
    (await world.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? -1;

  beforeEach(async () => {
    now = START;
    tokens = 0;
    world = await create({
      now: () => new Date(now),
      newToken: () => `order-token-${String(++tokens).padStart(4, '0')}`,
    });
  });

  async function placeWith(options: { customer?: string; extra?: Record<string, unknown> } = {}) {
    const reply = await call('POST', `/api/s/${SLUG}/orders`, {
      ...(options.customer !== undefined ? { customer: options.customer } : {}),
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
        ...options.extra,
      },
    });
    expect(reply.status, reply.text).toBe(201);
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (!order) throw new Error(reply.text);
    const row = await world.db.first<{ customer_confirmed: number; customer_code: string | null }>(
      'SELECT customer_confirmed, customer_code FROM orders WHERE token = ?',
      order.token,
    );
    return { token: order.token, code: order.code, row };
  }
  const seller = async () => (await world.repo.sellerBySlug(SLUG)) as SellerRepository;

  it('a full session makes the order confirmed, with the kitchen code, a link and last_order_at', async () => {
    const { cookie, reply } = await customer();
    const accountCode = (await call('GET', `/api/customer/me?slug=${SLUG}`, { customer: cookie }))
      .body as { me: Me };
    void reply;
    now += DAY;
    const placed = await placeWith({ customer: cookie, extra: { customerCode: CODE } });
    expect(placed.row?.customer_confirmed).toBe(1);
    const stored = (await (await seller()).getByCode(placed.code))!;
    expect(stored.confirmed).toBe(true);
    expect(stored.customerCode).not.toBe(CODE); // the body's code is overridden
    expect(stored.customerCode).toBe(accountCode.me.customerCode);
    expect(shortCustomerCode(stored.customerCode ?? '')).toMatch(/^C-/);
    expect(
      await world.db.first('SELECT 1 AS x FROM customer_order_links WHERE token = ?', placed.token),
    ).not.toBeNull();
    const account = await world.db.first<{ last_order_at: string; first_name: string }>(
      'SELECT last_order_at, first_name FROM customer_accounts',
    );
    expect(account?.last_order_at).toBe(new Date(now).toISOString());
    expect(account?.first_name).toBe('Rina');
  });

  it('no cookie, a bad cookie, a body flag or a setup session never confirm; ordering still works', async () => {
    const plain = await placeWith({ extra: { confirmed: true, customer_confirmed: true } });
    expect(plain.row?.customer_confirmed).toBe(0);
    const bad = await placeWith({ customer: 'not-a-session-token', extra: { confirmed: true } });
    expect(bad.row?.customer_confirmed).toBe(0);
    const { cookie } = await customer();
    const made = await call('POST', '/api/customer/phone-codes', { customer: cookie });
    const joined = await call('POST', '/api/customer/code', {
      body: { deviceId: PHONE_B, code: (made.body as { code: string }).code },
    });
    const setup = await placeWith({
      customer: customerCookie(joined),
      extra: { customerCode: CODE },
    });
    expect(setup.row).toEqual({ customer_confirmed: 0, customer_code: CODE });
    expect(await count('customer_order_links')).toBe(0);
    // An expired session is just a normal order.
    await world.db
      .stmt('UPDATE customer_sessions SET expires_at = ?', new Date(now - MIN).toISOString())
      .run();
    const expired = await placeWith({ customer: cookie });
    expect(expired.row?.customer_confirmed).toBe(0);
  });

  it('a seller-entered order is never confirmed', async () => {
    const store = await seller();
    const made = await store.createSellerOrder(
      {
        firstName: 'Budi',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
        customerCode: CODE,
      },
      { role: 'seller', name: 'Owner' },
    );
    if (!made.ok) throw new Error(made.message);
    expect(made.value.confirmed).toBeUndefined();
    const row = await world.db.first<{ customer_confirmed: number }>(
      'SELECT customer_confirmed FROM orders WHERE id = ?',
      made.value.id,
    );
    expect(row?.customer_confirmed).toBe(0);
  });

  it('a customer change (PATCH) does not confirm', async () => {
    const placed = await placeWith();
    const { cookie } = await customer();
    const patched = await call('PATCH', `/api/orders/${placed.token}`, {
      customer: cookie,
      body: { note: 'less spicy' },
    });
    expect(patched.status).toBe(200);
    const row = await world.db.first<{ customer_confirmed: number }>(
      'SELECT customer_confirmed FROM orders WHERE token = ?',
      placed.token,
    );
    expect(row?.customer_confirmed).toBe(0);
  });

  it('the backup carries the flag and a restore keeps it', async () => {
    const { cookie } = await customer();
    const placed = await placeWith({ customer: cookie });
    const store = await seller();
    const file = await store.exportBackup();
    const json = JSON.parse(JSON.stringify(file)) as unknown;
    const parsed = parseBackupFile(json);
    expect(parsed?.orders?.find((o) => o.code === placed.code)?.confirmed).toBe(true);
    await store.restoreBackup(parsed!);
    const row = await world.db.first<{ customer_confirmed: number }>(
      'SELECT customer_confirmed FROM orders WHERE token = ?',
      placed.token,
    );
    expect(row?.customer_confirmed).toBe(1);
  });

  it('the sealed address is kept 30 days from the last confirmed order', async () => {
    const { cookie } = await customer();
    expect(
      (await call('PUT', '/api/customer/address', { customer: cookie, body: SEALED })).status,
    ).toBe(200);
    now += DAY;
    await placeWith({ customer: cookie });
    now += 29 * DAY; // 30 days from sign-up, 29 from the order
    await sweepCustomerHourly(world.db, new Date(now));
    expect(await count('customer_sealed_addresses')).toBe(1);
    now += 2 * DAY;
    await sweepCustomerHourly(world.db, new Date(now));
    expect(await count('customer_sealed_addresses')).toBe(0);
  });
});
