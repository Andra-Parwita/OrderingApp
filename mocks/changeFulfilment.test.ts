// @vitest-environment node
// Plan 083: the seller (owner or chef) switches an order between pickup and delivery, optionally
// telling the customer (inbox entry + push in the order's language). Helpers are refused.
import { beforeEach, describe, expect, it } from 'vitest';
import type { DeliveryAddress } from '../shared/address';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import type { SellerOrder } from '../shared/domain';
import { parseCustomerOrderResponse, parseSellerOrderResponse } from '../shared/orderContract';
import type { PushPayload } from '../shared/pushContract';
import { importAddressKey } from '../worker/db/address';
import { createPushDispatcher, type CustomerChange } from '../worker/push/dispatch';
import type { PushSender } from '../worker/push/sender';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');
const SECRET = Buffer.alloc(32, 9).toString('base64');
const ADDRESS: DeliveryAddress = { street: '5 Rose Street', suburb: 'Norwood', postcode: '5067' };

describe('seller changes pickup / delivery (plan 083)', () => {
  const create = useWorld('change-fulfilment');
  let world: World;
  let tokens = 0;
  let key: CryptoKey | null;
  let sent: Array<PushPayload>;
  let collect: (changes: Array<CustomerChange>) => void;
  let dispatcher: ReturnType<typeof createPushDispatcher>;

  type Reply = { status: number; body: unknown; setCookie: string | null; text: string };
  async function call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = { Origin: 'https://change.test' };
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://change.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      { addressKey: key },
    );
    const text = response ? await response.text() : '';
    const setCookie = response?.headers.get('set-cookie') ?? null;
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON
    }
    return { status: response?.status ?? -1, body, setCookie, text };
  }
  function session(reply: Reply) {
    const parsed = parseSessionResponse(reply.body);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!parsed || !token) throw new Error(`not a session: ${reply.text}`);
    return { ...parsed, token };
  }
  async function newPerson(inviteKey: string, deviceId: string) {
    const setup = session(
      await call('POST', '/api/auth/invite', { body: { key: inviteKey, deviceId } }),
    );
    return session(
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password: 'a long enough password', deviceName: 'Phone' },
      }),
    );
  }
  const keyOf = (reply: Reply) => parseKeyResponse(reply.body)?.key ?? '';
  async function people() {
    const made = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'olive',
    });
    const boss = await newPerson(made.key, 'olive-0001-aaaa');
    const helper = await newPerson(
      keyOf(
        await call('POST', '/api/seller/invites', {
          token: boss.token,
          body: { displayName: 'Dewi', role: 'helper' },
        }),
      ),
      'helper-0001-bb',
    );
    const chef = await newPerson(
      keyOf(
        await call('POST', '/api/seller/chef-invites', {
          token: boss.token,
          body: { chefId: 'wati' },
        }),
      ),
      'wati-0001-bbbb',
    );
    return { boss, helper, chef };
  }

  async function place(language: 'en' | 'id', fulfilment: 'pickup' | 'delivery' = 'pickup') {
    const places = await world.db.all<{ id: string }>(
      'SELECT id FROM pickup_places WHERE seller_id = ? ORDER BY position',
      SELLER_ID,
    );
    const reply = await call('POST', '/api/s/onde-onde/orders', {
      body: {
        firstName: 'Rina',
        language,
        fulfilment,
        lines: [{ itemId: 'pesmol', qty: 1 }],
        ...(fulfilment === 'pickup' ? { pickupPlaceId: places[0]?.id } : { address: ADDRESS }),
      },
    });
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (reply.status !== 201 || !order) throw new Error(reply.text);
    await call('POST', `/api/orders/${order.token}/push`, {
      body: {
        endpoint: 'https://push.example.test/send/endpoint-1',
        keys: { p256dh: 'BPublicKeyOfTheBrowser_abc-123', auth: 'AuthSecret_xyz-789' },
      },
    });
    return { token: order.token, code: order.code, places: places.map((p) => p.id) };
  }

  const patch = (token: string, code: string, body: unknown) =>
    call('PATCH', `/api/seller/orders/${code}/fulfilment`, { token, body });
  const orderOf = (reply: Reply): SellerOrder => {
    const order = parseSellerOrderResponse(reply.body)?.order;
    if (!order) throw new Error(reply.text);
    return order;
  };
  const addressCipher = async (code: string) =>
    (
      await world.db.first<{ address_enc: string | null }>(
        'SELECT address_enc FROM orders WHERE code = ?',
        code,
      )
    )?.address_enc;
  const customerView = async (token: string) => {
    const reply = await call('GET', `/api/orders/${token}`);
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (!order) throw new Error(reply.text);
    return order;
  };

  beforeEach(async () => {
    tokens = 0;
    sent = [];
    key = await importAddressKey(SECRET);
    collect = () => undefined;
    world = await create({
      now: () => new Date(START),
      newToken: () => `token-${String(++tokens)}-padding-padding`,
      onCustomerChange: (changes) => {
        collect(changes);
      },
    });
    const sender: PushSender = (_target, payload) => {
      sent.push(payload);
      return Promise.resolve(201);
    };
    dispatcher = createPushDispatcher({ db: world.db, sender, log: () => undefined });
    collect = dispatcher.collect;
  });

  it('refuses a helper and lets the owner and a chef switch', async () => {
    const { boss, helper, chef } = await people();
    const { code, places } = await place('en');
    const body = { fulfilment: 'delivery', address: ADDRESS, notify: false };
    expect((await patch(helper.token, code, body)).status).toBe(403);
    const byChef = await patch(chef.token, code, body);
    expect(byChef.status, byChef.text).toBe(200);
    expect(orderOf(byChef).fulfilment).toBe('delivery');
    const back = await patch(boss.token, code, {
      fulfilment: 'pickup',
      pickupPlaceId: places[0],
      notify: false,
    });
    expect(back.status, back.text).toBe(200);
    expect(orderOf(back).pickupPlaceId).toBe(places[0]);
    expect(orderOf(back).audit[0]?.what).toBe('edited');
  });

  it('needs a known place for pickup and a street for delivery', async () => {
    const { boss } = await people();
    const { code } = await place('en', 'delivery');
    const unknown = { fulfilment: 'pickup', pickupPlaceId: 'nowhere', notify: false };
    expect((await patch(boss.token, code, unknown)).status).toBe(400);
    expect((await patch(boss.token, code, { fulfilment: 'pickup', notify: false })).status).toBe(
      400,
    );
    const noStreet = {
      fulfilment: 'delivery',
      address: { ...ADDRESS, street: ' ' },
      notify: false,
    };
    expect((await patch(boss.token, code, noStreet)).status).toBe(400);
    expect((await patch(boss.token, code, { fulfilment: 'delivery', notify: false })).status).toBe(
      400,
    );
  });

  it('refuses a cancelled order with 409', async () => {
    const { boss } = await people();
    const { code } = await place('en');
    await call('POST', `/api/seller/orders/${code}/status`, {
      token: boss.token,
      body: { to: 'cancelled' },
    });
    const reply = await patch(boss.token, code, {
      fulfilment: 'delivery',
      address: ADDRESS,
      notify: false,
    });
    expect(reply.status).toBe(409);
  });

  it('with notify: an inbox entry and a push in the order language, the address kept encrypted', async () => {
    const { boss } = await people();
    const { code, token, places } = await place('id');
    const reply = await patch(boss.token, code, {
      fulfilment: 'delivery',
      address: ADDRESS,
      notify: true,
    });
    expect(reply.status, reply.text).toBe(200);
    await dispatcher.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.title).toBe('Pesanan diubah');
    expect(sent[0]?.body).toBe('Pesananmu sekarang diantar.');
    expect(sent[0]?.body).not.toContain('Rose');
    const seen = await customerView(token);
    expect(seen.fulfilment).toBe('delivery');
    expect(seen.inbox[0]?.text).toBe('Pesananmu sekarang diantar.');
    expect(seen.inbox[0]?.text).not.toContain('Rose');
    const cipher = await addressCipher(code);
    expect(cipher).toBeTruthy();
    expect(cipher).not.toContain('Rose');
    // The seller reads the address back.
    const read = await call('GET', `/api/seller/orders/${code}`, { token: boss.token });
    expect(JSON.stringify(read.body)).toContain('5 Rose Street');

    // Back to pickup: the address goes, the text names the place and its times.
    sent = [];
    const pickup = await patch(boss.token, code, {
      fulfilment: 'pickup',
      pickupPlaceId: places[0],
      notify: true,
    });
    expect(pickup.status, pickup.text).toBe(200);
    expect(await addressCipher(code)).toBeNull();
    await dispatcher.flush();
    expect(sent[0]?.body).toMatch(/^Pesananmu sekarang diambil di .+, \d\d:\d\d–\d\d:\d\d$/);
  });

  it('with notify false: no inbox entry and no push, the page still shows the new way', async () => {
    const { boss } = await people();
    const { code, token } = await place('en');
    const before = (await customerView(token)).inbox.length;
    const reply = await patch(boss.token, code, {
      fulfilment: 'delivery',
      address: ADDRESS,
      notify: false,
    });
    expect(reply.status).toBe(200);
    await dispatcher.flush();
    expect(sent).toHaveLength(0);
    const seen = await customerView(token);
    expect(seen.inbox).toHaveLength(before);
    expect(seen.fulfilment).toBe('delivery');
  });

  it('works on a locked order and on a private order, and tells in English', async () => {
    const { boss, chef } = await people();
    const { code, token } = await place('en');
    await world.db.stmt('UPDATE orders SET locked = 1 WHERE code = ?', code).run();
    const locked = await patch(chef.token, code, {
      fulfilment: 'delivery',
      address: ADDRESS,
      notify: true,
    });
    expect(locked.status, locked.text).toBe(200);
    await dispatcher.flush();
    expect(sent[0]?.body).toBe('Your order is now for delivery.');
    expect((await customerView(token)).locked).toBe(true);

    const dish = await world.db.first<{ id: string }>(
      'SELECT id FROM dishes WHERE seller_id = ? ORDER BY id',
      SELLER_ID,
    );
    const created = await call('POST', '/api/seller/private', {
      token: boss.token,
      body: {
        firstName: 'Ibu Sari',
        language: 'id',
        eventDate: '2026-10-10',
        fulfilment: 'delivery',
        address: ADDRESS,
        lines: [{ dishId: dish?.id, qty: 1 }],
      },
    });
    const privateOrder = orderOf(created);
    const place0 = await world.db.first<{ id: string }>(
      'SELECT id FROM pickup_places WHERE seller_id = ?',
      SELLER_ID,
    );
    const moved = await patch(chef.token, privateOrder.code, {
      fulfilment: 'pickup',
      pickupPlaceId: place0?.id,
      notify: false,
    });
    expect(moved.status, moved.text).toBe(200);
    expect(orderOf(moved).fulfilment).toBe('pickup');
    expect(await addressCipher(privateOrder.code)).toBeNull();
  });
});
