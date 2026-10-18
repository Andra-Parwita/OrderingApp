// @vitest-environment node
// Plan 105: the seller (owner or chef) edits dishes, note and name of any menu order, in any status,
// optionally telling the customer (inbox entry + push). Helpers are refused; private orders too.
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

describe('seller edits an order (plan 105)', () => {
  const create = useWorld('edit-order');
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
    const headers: Record<string, string> = { Origin: 'https://edit.test' };
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://edit.test${path}`, {
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

  const orderOf = (reply: Reply): SellerOrder => {
    const order = parseSellerOrderResponse(reply.body)?.order;
    if (!order) throw new Error(reply.text);
    return order;
  };
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

  const edit = (token: string, code: string, body: unknown) =>
    call('PATCH', `/api/seller/orders/${code}`, { token, body });
  const menuItems = () =>
    world.db.all<{ id: string; portion_limit: number | null }>(
      'SELECT id, portion_limit FROM menu_items WHERE seller_id = ? ORDER BY position',
      SELLER_ID,
    );
  async function placeLines(lines: Array<{ itemId: string; qty: number }>) {
    const reply = await call('POST', '/api/s/onde-onde/orders', {
      body: { firstName: 'Lenni', language: 'en', fulfilment: 'delivery', address: ADDRESS, lines },
    });
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (reply.status !== 201 || !order) throw new Error(reply.text);
    await call('POST', `/api/orders/${order.token}/push`, {
      body: {
        endpoint: 'https://push.example.test/send/endpoint-1',
        keys: { p256dh: 'BPublicKeyOfTheBrowser_abc-123', auth: 'AuthSecret_xyz-789' },
      },
    });
    return { token: order.token, code: order.code };
  }
  const status = (token: string, code: string, to: string) =>
    call('POST', `/api/seller/orders/${code}/status`, { token, body: { to, force: true } });

  it('refuses a helper and bad bodies, lets the owner and a chef edit', async () => {
    const { boss, helper, chef } = await people();
    const [a] = await menuItems();
    const { code } = await placeLines([{ itemId: a?.id ?? '', qty: 1 }]);
    const body = { note: 'Door please', notify: false };
    expect((await edit(helper.token, code, body)).status).toBe(403);
    expect((await edit(boss.token, code, { note: 'x' })).status).toBe(400);
    expect((await edit(boss.token, code, { lines: [], notify: false })).status).toBe(400);
    expect((await edit(boss.token, code, { phone: '0412345678', notify: false })).status).toBe(400);
    const byChef = await edit(chef.token, code, body);
    expect(byChef.status, byChef.text).toBe(200);
    expect(orderOf(byChef).note).toBe('Door please');
    expect((await edit(boss.token, 'ZZZ-ZZZ', body)).status).toBe(404);
  });

  it('changes a count, removes a dish, adds another and renames; the audit has the diff and total', async () => {
    const { boss } = await people();
    const [a, b, c] = await menuItems();
    const { code } = await placeLines([
      { itemId: a?.id ?? '', qty: 2 },
      { itemId: b?.id ?? '', qty: 1 },
    ]);
    const reply = await edit(boss.token, code, {
      firstName: 'Lenny',
      lines: [
        { itemId: a?.id ?? '', qty: 3 },
        { itemId: c?.id ?? '', qty: 1 },
      ],
      notify: false,
    });
    expect(reply.status, reply.text).toBe(200);
    const order = orderOf(reply);
    expect(order.firstName).toBe('Lenny');
    expect(order.lines.map((l) => [l.itemId, l.qty])).toEqual([
      [a?.id, 3],
      [c?.id, 1],
    ]);
    const entry = order.audit[0];
    expect(entry?.what).toBe('edited');
    expect(entry?.by.role).toBe('seller');
    expect(entry?.diff?.name).toEqual({ from: 'Lenni', to: 'Lenny' });
    expect(entry?.diff?.items.map((i) => i.delta).sort()).toEqual([-1, 1, 1]);
    expect(entry?.diff?.total).toBeDefined();
    expect(order.changed).toBe(false);
    const row = await world.db.first<{ first_name: string }>(
      'SELECT first_name FROM orders WHERE code = ?',
      code,
    );
    expect(row?.first_name).toBe('Lenny');
    // Nothing differs: no new audit entry.
    const same = orderOf(await edit(boss.token, code, { firstName: 'Lenny', notify: false }));
    expect(same.audit).toHaveLength(order.audit.length);
  });

  it('clears the Changed flag a customer edit set', async () => {
    const { boss } = await people();
    const [a] = await menuItems();
    const { code, token } = await placeLines([{ itemId: a?.id ?? '', qty: 1 }]);
    await call('PATCH', `/api/orders/${token}`, { body: { note: 'new note' } });
    const flagged = await call('GET', `/api/seller/orders/${code}`, { token: boss.token });
    expect(orderOf(flagged).changed).toBe(true);
    const done = orderOf(await edit(boss.token, code, { note: 'seen', notify: false }));
    expect(done.changed).toBe(false);
  });

  it('accepts a locked, delivered and a cancelled order (which stays cancelled)', async () => {
    const { boss } = await people();
    const [a] = await menuItems();
    const { code } = await placeLines([{ itemId: a?.id ?? '', qty: 1 }]);
    await call('POST', `/api/seller/orders/${code}/lock`, {
      token: boss.token,
      body: { locked: true },
    });
    await status(boss.token, code, 'delivered');
    const delivered = await edit(boss.token, code, { note: 'late fix', notify: false });
    expect(delivered.status, delivered.text).toBe(200);
    expect(orderOf(delivered).status).toBe('delivered');
    await status(boss.token, code, 'cancelled');
    const cancelled = orderOf(
      await edit(boss.token, code, { lines: [{ itemId: a?.id ?? '', qty: 2 }], notify: false }),
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.lines[0]?.qty).toBe(2);
  });

  it('re-activates a cancelled order to Ordered', async () => {
    const { boss } = await people();
    const [a] = await menuItems();
    const { code } = await placeLines([{ itemId: a?.id ?? '', qty: 1 }]);
    await status(boss.token, code, 'cancelled');
    const back = orderOf(
      await edit(boss.token, code, {
        lines: [{ itemId: a?.id ?? '', qty: 2 }],
        notify: false,
        reactivate: true,
      }),
    );
    expect(back.status).toBe('ordered');
    expect(back.audit.some((e) => e.what === 'status' && e.detail === 'ordered')).toBe(true);
  });

  it('warns over a portion limit and goes ahead with force', async () => {
    const { boss } = await people();
    const items = await menuItems();
    const limited = items.find((i) => i.portion_limit !== null);
    if (!limited) throw new Error('no limited dish in the seed');
    const { code } = await placeLines([{ itemId: limited.id, qty: 1 }]);
    const over = { lines: [{ itemId: limited.id, qty: (limited.portion_limit ?? 0) + 5 }] };
    const warned = await edit(boss.token, code, { ...over, notify: false });
    expect(warned.status).toBe(409);
    expect(warned.text).toContain('over_limit');
    const forced = await edit(boss.token, code, { ...over, notify: false, force: true });
    expect(forced.status, forced.text).toBe(200);
    expect(orderOf(forced).lines[0]?.qty).toBe((limited.portion_limit ?? 0) + 5);
  });

  it('with notify: an inbox entry and a push in the order language; silent adds none', async () => {
    const { boss } = await people();
    const [a, b] = await menuItems();
    const { code, token } = await placeLines([{ itemId: a?.id ?? '', qty: 1 }]);
    const reply = await edit(boss.token, code, {
      lines: [
        { itemId: a?.id ?? '', qty: 1 },
        { itemId: b?.id ?? '', qty: 1 },
      ],
      notify: true,
    });
    expect(reply.status, reply.text).toBe(200);
    await dispatcher.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.title).toBe('Order changed');
    expect(sent[0]?.body).toMatch(/^Your order .+ was changed by /);
    const seen = await customerView(token);
    expect(seen.inbox[0]?.textKey).toBe('orderEdited');
    expect(seen.inbox[0]?.text).toMatch(/^\+1 /);
    sent = [];
    await edit(boss.token, code, { note: 'quiet', notify: false });
    await dispatcher.flush();
    expect(sent).toHaveLength(0);
    expect((await customerView(token)).inbox[0]?.textKey).toBe('orderEdited');
  });
});
