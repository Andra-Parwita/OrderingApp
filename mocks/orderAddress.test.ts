// @vitest-environment node
// Plan 071 stages 1-3 (server): delivery addresses are encrypted, team-only, never in customer or
// public answers or backups, and deleted a day after the menu, on cancel and on "delete now".
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkOnMapUrl,
  directionsUrl,
  parseDeliveryAddress,
  type DeliveryAddress,
} from '../shared/address';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { parseMenuResponse } from '../shared/menuContract';
import {
  parseCreateOrderRequest,
  parseCustomerOrderResponse,
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
} from '../shared/orderContract';
import { runAddressSweep } from '../worker/api/scheduled';
import { importAddressKey } from '../worker/db/address';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const OTHER_ID = 'seller-dapur-demo';
const SLUG = 'onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');
const HOUR = 3_600_000;
const SECRET = Buffer.alloc(32, 7).toString('base64');
const ADDRESS: DeliveryAddress = {
  street: '12 Zebra Crescent',
  suburb: 'Fitzroy',
  postcode: '3065',
  notes: 'Gate code 4471, call when here',
  lat: -37.8,
  lng: 144.98,
};
const PLAIN = ['Zebra Crescent', 'Fitzroy', 'Gate code', '4471'];

describe('delivery addresses (plan 071)', () => {
  const create = useWorld('order-address');
  let world: World;
  let tokens = 0;
  let key: CryptoKey | null;
  let now = START;

  type Reply = { status: number; body: unknown; setCookie: string | null; text: string };
  async function call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown; noKey?: boolean; key?: CryptoKey | null } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://addr.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      { addressKey: options.key !== undefined ? options.key : options.noKey ? null : key },
    );
    if (!response) return { status: -1, body: null, setCookie: null, text: '' };
    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');
    try {
      return { status: response.status, body: JSON.parse(text) as unknown, setCookie, text };
    } catch {
      return { status: response.status, body: text, setCookie, text };
    }
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
  async function owner(sellerId: string, id: string) {
    const made = await world.repo.auth.createKey({ role: 'owner', sellerId, displayName: id });
    return newPerson(made.key, `${id}-0001-aaaa`);
  }
  async function people() {
    const boss = await owner(SELLER_ID, 'olive');
    const keyOf = (reply: Reply) => parseKeyResponse(reply.body)?.key ?? '';
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
    const other = await owner(OTHER_ID, 'dewa');
    return { boss, helper, chef, other };
  }

  async function place(
    address: DeliveryAddress | undefined = ADDRESS,
    fulfilment: 'delivery' | 'pickup' = 'delivery',
    options: { noKey?: boolean } = {},
  ) {
    const reply = await call('POST', `/api/s/${SLUG}/orders`, {
      ...options,
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment,
        lines: [{ itemId: 'pesmol', qty: 1 }],
        ...(address ? { address } : {}),
      },
    });
    const parsed = parseCustomerOrderResponse(reply.body);
    if (reply.status !== 201 || !parsed) throw new Error(`not placed: ${reply.text}`);
    return { reply, order: parsed.order };
  }
  const stored = async () =>
    (await world.db.all<{ address_enc: string | null }>('SELECT address_enc FROM orders')).map(
      (row) => row.address_enc,
    );
  const read = async (who: { token: string }, code: string) => {
    const reply = await call('GET', `/api/seller/orders/${code}`, { token: who.token });
    return { reply, order: parseSellerOrderResponse(reply.body)?.order };
  };

  beforeEach(async () => {
    tokens = 0;
    now = START;
    key = await importAddressKey(SECRET);
    world = await create({ now: () => new Date(now), newToken: () => `token-${String(++tokens)}` });
  });

  // plan 071 stage 4: the anonymous customer code
  const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
  const placeWithCode = async (customerCode?: string) => {
    const reply = await call('POST', `/api/s/${SLUG}/orders`, {
      body: {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
        ...(customerCode !== undefined ? { customerCode } : {}),
      },
    });
    const parsed = parseCustomerOrderResponse(reply.body);
    if (reply.status !== 201 || !parsed) throw new Error(`not placed: ${reply.text}`);
    return { order: parsed.order, text: reply.text };
  };

  it('an order carries the customer code; only the kitchen team reads it back', async () => {
    const { boss, helper, other } = await people();
    const { order, text } = await placeWithCode(CODE);
    expect(text).not.toContain(CODE); // not in the customer's own answer
    expect((await call('GET', `/api/orders/${order.token}`)).text).not.toContain(CODE);
    expect((await read(boss, order.code)).order?.customerCode).toBe(CODE);
    expect((await read(helper, order.code)).order?.customerCode).toBe(CODE);
    const list = await call('GET', '/api/seller/orders', { token: boss.token });
    expect(parseSellerOrdersResponse(list.body)?.orders[0]?.customerCode).toBe(CODE);
    expect((await read(other, order.code)).order).toBeUndefined();
    // the public menu never has it
    expect((await call('GET', `/api/s/${SLUG}/menu`)).text).not.toContain(CODE);
  });

  it('is optional (old apps send none) and a malformed code is refused', async () => {
    const { boss } = await people();
    const { order } = await placeWithCode();
    expect((await read(boss, order.code)).order?.customerCode).toBeUndefined();
    expect(
      parseCreateOrderRequest({
        firstName: 'R',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'a', qty: 1 }],
        customerCode: 'rina-0412',
      }),
    ).toBeNull();
    const bad = await call('POST', `/api/s/${SLUG}/orders`, {
      body: {
        firstName: 'R',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
        customerCode: '0412345678',
      },
    });
    expect(bad.status).toBe(400);
  });

  it('stores ciphertext (never the text) that round-trips for the team, with a fresh IV each time', async () => {
    const { boss } = await people();
    const first = await place();
    const second = await place();
    const rows = (await stored()).filter((row): row is string => row !== null);
    expect(rows).toHaveLength(2);
    for (const row of rows) for (const word of PLAIN) expect(row).not.toContain(word);
    // the whole database holds none of the words
    const dump = JSON.stringify(await world.db.all('SELECT * FROM orders'));
    for (const word of PLAIN) expect(dump).not.toContain(word);
    expect(rows[0]?.split('.')[0]).not.toBe(rows[1]?.split('.')[0]);
    expect((await read(boss, first.order.code)).order?.address).toEqual({ address: ADDRESS });
    expect((await read(boss, second.order.code)).order?.address).toEqual({ address: ADDRESS });
  });

  it('the owner, a chef and a helper of the kitchen read it; another kitchen and the customer do not', async () => {
    const { boss, helper, chef, other } = await people();
    const { order } = await place();
    for (const who of [boss, chef, helper]) {
      expect((await read(who, order.code)).order?.address).toEqual({ address: ADDRESS });
    }
    const list = parseSellerOrdersResponse(
      (await call('GET', '/api/seller/orders', { token: helper.token })).body,
    );
    expect(list?.orders[0]?.address).toEqual({ address: ADDRESS });
    // another kitchen: no such order, and its own list is empty
    expect((await read(other, order.code)).reply.status).toBe(404);
    const theirs = await call('GET', '/api/seller/orders', { token: other.token });
    for (const word of PLAIN) expect(theirs.text).not.toContain(word);
    // the customer, by token: only a flag
    const mine = await call('GET', `/api/orders/${order.token}`);
    expect(parseCustomerOrderResponse(mine.body)?.order.addressState).toBe('saved');
    for (const word of PLAIN) expect(mine.text).not.toContain(word);
    expect(mine.text).not.toContain('address"');
    expect(order.addressState).toBe('saved');
    expect(JSON.stringify(order)).not.toContain('Zebra');
  });

  it('never appears in the public menu, the customer list, a backup or the orders CSV', async () => {
    const { boss } = await people();
    const { order } = await place();
    const outputs = [
      await call('GET', `/api/s/${SLUG}/menu`),
      await call('GET', `/api/orders?tokens=${order.token}`),
      await call('GET', '/api/seller/backup', { token: boss.token }),
      await call('GET', '/api/seller/orders.csv', { token: boss.token }),
      await call('GET', `/api/seller/messages`, { token: boss.token }),
    ];
    for (const reply of outputs) {
      expect(reply.status).toBe(200);
      for (const word of PLAIN) expect(reply.text).not.toContain(word);
      expect(reply.text).not.toContain('address_enc');
    }
    // a backup restored elsewhere carries no address either
    const backup = outputs[2]?.body;
    expect(JSON.stringify(backup)).not.toContain('"address"');
  });

  it('a status change still answers with the address for the team', async () => {
    const { boss } = await people();
    const { order } = await place();
    const moved = await call('POST', `/api/seller/orders/${order.code}/status`, {
      token: boss.token,
      body: { to: 'confirmed' },
    });
    expect(parseSellerOrderResponse(moved.body)?.order.address).toEqual({ address: ADDRESS });
  });

  it('a wrong or missing key reads as not available, and the customer is told to enter it again', async () => {
    const { boss } = await people();
    const { order } = await place();
    const wrong = await importAddressKey(Buffer.alloc(32, 9).toString('base64'));
    for (const useKey of [wrong, null]) {
      const reply = await call('GET', `/api/seller/orders/${order.code}`, {
        token: boss.token,
        key: useKey,
      });
      expect(parseSellerOrderResponse(reply.body)?.order.address).toEqual({ unavailable: true });
      const mine = await call('GET', `/api/orders/${order.token}`, { key: useKey });
      expect(parseCustomerOrderResponse(mine.body)?.order.addressState).toBe('unreadable');
    }
    // entering it again (with the working key) replaces it
    const again = { street: '3 New Rd', suburb: 'Carlton', postcode: '3053' };
    const patched = await call('PATCH', `/api/orders/${order.token}`, { body: { address: again } });
    expect(patched.status).toBe(200);
    expect((await read(boss, order.code)).order?.address).toEqual({ address: again });
  });

  it('without the key the menu says addresses are off and nothing is stored', async () => {
    const off = await call('GET', `/api/s/${SLUG}/menu`, { noKey: true });
    expect(parseMenuResponse(off.body)?.addresses).toBeUndefined();
    const on = await call('GET', `/api/s/${SLUG}/menu`);
    expect(parseMenuResponse(on.body)?.addresses).toBe(true);
    await place(ADDRESS, 'delivery', { noKey: true });
    expect(await stored()).toEqual([null]);
  });

  it('a customer edits the address until the cut-off; pickup or an empty address clears it', async () => {
    const { boss } = await people();
    const { order } = await place();
    const moved = { ...ADDRESS, street: '99 Moved St' };
    await call('PATCH', `/api/orders/${order.token}`, { body: { address: moved } });
    expect((await read(boss, order.code)).order?.address).toEqual({ address: moved });
    await call('PATCH', `/api/orders/${order.token}`, { body: { address: null } });
    expect((await read(boss, order.code)).order?.address).toBeUndefined();
    await call('PATCH', `/api/orders/${order.token}`, { body: { address: ADDRESS } });
    await call('PATCH', `/api/orders/${order.token}`, { body: { fulfilment: 'pickup' } });
    expect(await stored()).toEqual([null]);
  });

  it('a changed address shows "Address changed" and the customer "waiting" until a team member taps Got it; a new change resets it; the old address is not kept', async () => {
    const { boss, helper, chef } = await people();
    const { order } = await place();
    expect((await read(boss, order.code)).order?.addressChanged).toBeUndefined();
    // The same address again is not a change.
    await call('PATCH', `/api/orders/${order.token}`, { body: { address: ADDRESS } });
    expect((await read(boss, order.code)).order?.addressChanged).toBeUndefined();
    const moved = { ...ADDRESS, street: '99 Moved St' };
    const patched = await call('PATCH', `/api/orders/${order.token}`, { body: { address: moved } });
    expect(parseCustomerOrderResponse(patched.body)?.order.addressChange).toBe('waiting');
    expect((await read(boss, order.code)).order?.addressChanged).toBe('new');
    expect((await read(chef, order.code)).order?.addressChanged).toBe('new');
    const dump = JSON.stringify(await world.db.all('SELECT * FROM orders'));
    expect(dump).not.toContain('Zebra');
    // Opening or confirming does not clear it; Got it does, for everyone.
    await call('POST', `/api/seller/orders/${order.code}/seen`, { token: boss.token });
    expect((await read(boss, order.code)).order?.addressChanged).toBe('new');
    const got = await call('POST', `/api/seller/orders/${order.code}/address-seen`, {
      token: helper.token,
    });
    expect(got.status).toBe(200);
    expect((await read(boss, order.code)).order?.addressChanged).toBe('seen');
    expect((await read(chef, order.code)).order?.addressChanged).toBe('seen');
    const mine = await call('GET', `/api/orders/${order.token}`);
    expect(parseCustomerOrderResponse(mine.body)?.order.addressChange).toBe('seen');
    // Another change goes back to waiting.
    await call('PATCH', `/api/orders/${order.token}`, {
      body: { address: { ...moved, street: '5 Other Rd' } },
    });
    expect((await read(boss, order.code)).order?.addressChanged).toBe('new');
    const again = await call('GET', `/api/orders/${order.token}`);
    expect(parseCustomerOrderResponse(again.body)?.order.addressChange).toBe('waiting');
  });

  it('is deleted when the order is cancelled', async () => {
    const { order } = await place();
    expect((await stored())[0]).not.toBeNull();
    await call('POST', `/api/orders/${order.token}/cancel`);
    expect(await stored()).toEqual([null]);
  });

  it('"delete now" works for an owner or chef, not a helper, and not across kitchens', async () => {
    const { boss, helper, chef, other } = await people();
    const { order } = await place();
    const del = (who: { token: string }) =>
      call('POST', `/api/seller/orders/${order.code}/delete-address`, { token: who.token });
    expect((await del(helper)).status).toBe(403);
    expect((await del(other)).status).toBe(404);
    expect((await stored())[0]).not.toBeNull();
    expect((await del(chef)).status).toBe(200);
    expect(await stored()).toEqual([null]);
    expect((await read(boss, order.code)).order?.address).toBeUndefined();
  });

  it('is deleted one day after the menu finishes, by the hourly job', async () => {
    const { boss } = await people();
    await place();
    const finished = await call('POST', '/api/seller/menus/current/finish', { token: boss.token });
    expect(finished.status).toBe(200);
    expect((await stored())[0]).not.toBeNull();
    expect(await runAddressSweep({ DB: world.db.d1 }, new Date(START + 23 * HOUR))).toBe(0);
    expect((await stored())[0]).not.toBeNull();
    expect(await runAddressSweep({ DB: world.db.d1 }, new Date(START + 25 * HOUR))).toBe(1);
    expect(await stored()).toEqual([null]);
    expect(await runAddressSweep({ DB: world.db.d1 }, new Date(START + 26 * HOUR))).toBe(0);
  });

  it('a seller-entered order may carry an address too; bad addresses are refused', async () => {
    const { boss } = await people();
    const entered = await call('POST', '/api/seller/orders', {
      token: boss.token,
      body: {
        firstName: 'Budi',
        language: 'id',
        fulfilment: 'delivery',
        lines: [{ itemId: 'pesmol', qty: 1 }],
        address: ADDRESS,
      },
    });
    expect(parseSellerOrderResponse(entered.body)?.order.address).toEqual({ address: ADDRESS });
    for (const bad of [
      { street: '', suburb: 'x', postcode: '1' },
      { street: 'x'.repeat(121), suburb: '', postcode: '' },
      { street: '1 A St', suburb: '', postcode: '', lat: 1 },
      { street: '1 A St', suburb: '', postcode: '', lat: 91, lng: 0 },
      '12 Zebra Crescent',
    ]) {
      const reply = await call('POST', `/api/s/${SLUG}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'delivery',
          lines: [{ itemId: 'pesmol', qty: 1 }],
          address: bad,
        },
      });
      expect(reply.status).toBe(400);
    }
    // a phone number is still refused
    expect(
      parseCreateOrderRequest({
        firstName: 'A',
        language: 'en',
        fulfilment: 'delivery',
        lines: [{ itemId: 'x', qty: 1 }],
        phone: '0400',
      }),
    ).toBeNull();
  });
});

describe('address links', () => {
  it('Directions prefer the coordinates and never carry the notes', () => {
    const withCoords = directionsUrl(ADDRESS);
    expect(withCoords).toBe('https://www.google.com/maps/dir/?api=1&destination=-37.8,144.98');
    expect(directionsUrl(ADDRESS, true)).toBe('https://maps.apple.com/?daddr=-37.8,144.98');
    const plain = {
      street: '12 Zebra Crescent',
      suburb: 'Fitzroy',
      postcode: '3065',
      notes: 'Gate',
    };
    expect(directionsUrl(plain)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12%20Zebra%20Crescent%2C%20Fitzroy%203065',
    );
    expect(directionsUrl(plain)).not.toContain('Gate');
  });

  it('Check on map uses the typed address only', () => {
    expect(checkOnMapUrl(ADDRESS)).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20Zebra%20Crescent%2C%20Fitzroy%203065',
    );
    expect(checkOnMapUrl(ADDRESS, true)).toContain('https://maps.apple.com/?q=');
    expect(checkOnMapUrl(ADDRESS)).not.toContain('4471');
    expect(parseDeliveryAddress({ ...ADDRESS, notes: '  ' })?.notes).toBeUndefined();
  });
});
