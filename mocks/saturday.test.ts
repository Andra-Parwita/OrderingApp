// Stage 7.1: Saturday tools — "arriving soon", bulk updates, recipient groups, hand-over by code.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import type { SellerOrder } from '../shared/domain';
import { parseSellerOrderResponse, parseSellerOrdersResponse } from '../shared/orderContract';
import { formatOrderCode } from '../shared/orderCode';
import {
  parseSendUpdatesResponse,
  recipientCodes,
  UPDATE_TEXT_MAX,
} from '../shared/updateContract';
import { handleMockRequest } from '../worker/mock/routes';
import { createStore, type MockStore } from '../worker/mock/store';

const NOW = new Date('2026-10-07T10:00:00Z');
let store: MockStore;
let tokenCounter = 0;

type Reply = { status: number; body: unknown };

async function call(method: string, path: string, body?: unknown, seller?: string): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (seller) headers['X-Seller'] = seller;
  const response = await handleMockRequest(
    store,
    new Request(`https://delave.test${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  if (!response) return { status: -1, body: null };
  return { status: response.status, body: await response.json() };
}

async function place(fulfilment: 'pickup' | 'delivery', name = 'Rina') {
  const reply = await call('POST', '/api/s/onde-onde/orders', {
    firstName: name,
    language: 'en',
    fulfilment,
    lines: [{ itemId: 'pesmol', qty: 1 }],
  });
  if (reply.status !== 201) throw new Error(JSON.stringify(reply));
  const list = parseSellerOrdersResponse((await call('GET', '/api/seller/orders')).body);
  return list?.orders.find((order) => order.firstName === name) as SellerOrder;
}

async function orderOf(code: string): Promise<SellerOrder> {
  const parsed = parseSellerOrderResponse((await call('GET', `/api/seller/orders/${code}`)).body);
  return parsed?.order as SellerOrder;
}

async function move(code: string, to: string) {
  return call('POST', `/api/seller/orders/${code}/status`, { to });
}

const send = (body: unknown) => call('POST', '/api/seller/updates', body);

beforeEach(() => {
  tokenCounter = 0;
  store = createStore({ now: () => NOW, newToken: () => `token-${String(++tokenCounter)}` });
});

describe('arriving soon', () => {
  it('adds an inbox entry to a delivery order and nothing else', async () => {
    const order = await place('delivery');
    await move(order.code, 'confirmed');
    const reply = await call('POST', `/api/seller/orders/${order.code}/arriving-soon`);
    const after = parseSellerOrderResponse(reply.body)?.order as SellerOrder;
    expect(after.inbox[0]).toMatchObject({ kind: 'message', textKey: 'arrivingSoon' });
    expect(after.status).toBe('confirmed');
  });

  it('refuses pickup orders, closed orders and unknown codes', async () => {
    const pickup = await place('pickup');
    const refused = await call('POST', `/api/seller/orders/${pickup.code}/arriving-soon`);
    expect(refused.status).toBe(409);
    expect(parseApiError(refused.body)?.error).toBe('invalid_status');
    expect(
      parseApiError((await call('POST', '/api/seller/orders/ZZZZZZ/arriving-soon')).body)?.error,
    ).toBe('not_found');
    const delivery = await place('delivery', 'Tono');
    await move(delivery.code, 'confirmed');
    await move(delivery.code, 'out_for_delivery');
    await move(delivery.code, 'delivered');
    const closed = await call('POST', `/api/seller/orders/${delivery.code}/arriving-soon`);
    expect(closed.status).toBe(409);
  });
});

describe('bulk updates', () => {
  it('sends each template as an inbox message with its minutes', async () => {
    const order = await place('pickup');
    const templates = [
      { template: 'readyIn', minutes: 15 },
      { template: 'ready' },
      { template: 'arrived' },
      { template: 'arrivingIn', minutes: 10 },
      { template: 'outForDelivery' },
      { template: 'delivered' },
      { template: 'collected' },
    ];
    for (const entry of templates) {
      const reply = await send({ ...entry, codes: [order.code] });
      expect(parseSendUpdatesResponse(reply.body)?.sent, entry.template).toBe(1);
    }
    const inbox = (await orderOf(order.code)).inbox;
    expect(inbox.slice(0, 7).map((entry) => entry.textKey)).toEqual([
      'collected',
      'delivered',
      'outForDelivery',
      'arrivingIn',
      'arrived',
      'ready',
      'readyIn',
    ]);
    expect(inbox.find((entry) => entry.textKey === 'readyIn')?.minutes).toBe(15);
    expect(inbox.every((entry) => entry.kind !== 'message' || entry.textKey)).toBe(true);
    expect((await orderOf(order.code)).status).toBe('ordered'); // no status asked
  });

  it('needs minutes for the templates that carry them, and a short custom text', async () => {
    const order = await place('pickup');
    for (const bad of [
      { template: 'readyIn', codes: [order.code] },
      { template: 'arrivingIn', minutes: 0, codes: [order.code] },
      { template: 'custom', codes: [order.code] },
      { template: 'custom', text: '   ', codes: [order.code] },
      { template: 'custom', text: 'x'.repeat(UPDATE_TEXT_MAX + 1), codes: [order.code] },
      { template: 'nope', codes: [order.code] },
      { template: 'arrived', codes: [] },
      { template: 'arrived', codes: [''] },
      { template: 'arrived' },
    ]) {
      expect((await send(bad)).status, JSON.stringify(bad)).toBe(400);
    }
    const ok = await send({
      template: 'custom',
      text: ` ${'x'.repeat(UPDATE_TEXT_MAX)} `,
      codes: [order.code],
    });
    expect(ok.status).toBe(200);
    expect((await orderOf(order.code)).inbox[0]).toMatchObject({
      kind: 'message',
      text: 'x'.repeat(UPDATE_TEXT_MAX),
    });
  });

  it('accepts forgiving codes and reports per order, skipping duplicates and cancelled orders', async () => {
    const a = await place('pickup', 'Ana');
    const b = await place('pickup', 'Budi');
    await call('POST', `/api/seller/orders/${b.code}/status`, { to: 'cancelled' });
    const reply = await send({
      template: 'arrived',
      codes: [formatOrderCode(a.code).toLowerCase(), a.code, b.code, 'ZZZZZZ', 'oops'],
    });
    const parsed = parseSendUpdatesResponse(reply.body);
    expect(parsed?.sent).toBe(1);
    expect(parsed?.results).toEqual([
      { code: a.code, ok: true, statusChanged: false },
      { code: b.code, ok: false, error: 'invalid_status' },
      { code: 'ZZZZZZ', ok: false, error: 'not_found' },
      { code: 'oops', ok: false, error: 'not_found' },
    ]);
  });

  it('changes the status only where nextStatuses allows, and reports it', async () => {
    const pickup = await place('pickup', 'Ana');
    const delivery = await place('delivery', 'Budi');
    await move(pickup.code, 'confirmed');
    await move(delivery.code, 'confirmed');
    const stuck = await place('pickup', 'Cici'); // still "ordered": ready is not allowed yet

    const ready = parseSendUpdatesResponse(
      (
        await send({
          template: 'ready',
          alsoSetStatus: true,
          codes: [pickup.code, delivery.code, stuck.code],
        })
      ).body,
    );
    expect(ready?.results.map((entry) => entry.statusChanged)).toEqual([true, false, false]);
    expect((await orderOf(pickup.code)).status).toBe('ready_for_pickup');
    expect((await orderOf(delivery.code)).status).toBe('confirmed');
    expect((await orderOf(stuck.code)).status).toBe('ordered');
    // The plain "ready" twin of the status adds no second message; the others do get the message.
    expect((await orderOf(pickup.code)).inbox[0]).toMatchObject({
      kind: 'status',
      status: 'ready_for_pickup',
    });
    expect(
      (await orderOf(pickup.code)).inbox.filter((entry) => entry.textKey === 'ready'),
    ).toHaveLength(0);
    expect((await orderOf(delivery.code)).inbox[0]).toMatchObject({
      kind: 'message',
      textKey: 'ready',
    });
    // The audit says who moved it.
    expect((await orderOf(pickup.code)).audit[0]).toMatchObject({
      what: 'status',
      detail: 'ready_for_pickup',
      by: { role: 'seller' },
    });

    const out = parseSendUpdatesResponse(
      (
        await send({
          template: 'arrivingIn',
          minutes: 20,
          alsoSetStatus: true,
          codes: [delivery.code, pickup.code],
        })
      ).body,
    );
    expect(out?.results.map((entry) => entry.statusChanged)).toEqual([true, false]);
    expect((await orderOf(delivery.code)).status).toBe('out_for_delivery');
    const inbox = (await orderOf(delivery.code)).inbox;
    expect(inbox[0]).toMatchObject({ kind: 'status', status: 'out_for_delivery' });
    expect(inbox[1]).toMatchObject({ kind: 'message', textKey: 'arrivingIn', minutes: 20 });

    await send({ template: 'delivered', alsoSetStatus: true, codes: [delivery.code] });
    await send({ template: 'collected', alsoSetStatus: true, codes: [pickup.code] });
    expect((await orderOf(delivery.code)).status).toBe('delivered');
    expect((await orderOf(pickup.code)).status).toBe('collected');
    // "arrived" and "custom" have no status, so asking for one changes nothing.
    const arrived = parseSendUpdatesResponse(
      (await send({ template: 'arrived', alsoSetStatus: true, codes: [stuck.code] })).body,
    );
    expect(arrived?.results[0]?.statusChanged).toBe(false);
    expect((await orderOf(stuck.code)).status).toBe('ordered');
  });

  it("never touches another seller's orders", async () => {
    const order = await place('pickup');
    const reply = await call(
      'POST',
      '/api/seller/updates',
      { template: 'arrived', codes: [order.code] },
      'dapur-demo',
    );
    expect(parseSendUpdatesResponse(reply.body)?.results[0]).toMatchObject({
      ok: false,
      error: 'not_found',
    });
    expect((await orderOf(order.code)).inbox.some((entry) => entry.textKey === 'arrived')).toBe(
      false,
    );
  });
});

describe('recipient groups', () => {
  it('picks open, pickup, delivery and not-done orders', async () => {
    const pickup = await place('pickup', 'Ana');
    const delivery = await place('delivery', 'Budi');
    const done = await place('pickup', 'Cici');
    const cancelled = await place('delivery', 'Dewi');
    for (const to of ['confirmed', 'ready_for_pickup', 'collected']) await move(done.code, to);
    await move(cancelled.code, 'cancelled');
    const orders =
      parseSellerOrdersResponse((await call('GET', '/api/seller/orders')).body)?.orders ?? [];
    const sorted = (codes: Array<string>) => [...codes].sort();
    expect(sorted(recipientCodes(orders, 'open'))).toEqual(
      sorted([pickup.code, delivery.code, done.code]),
    );
    expect(sorted(recipientCodes(orders, 'notDone'))).toEqual(sorted([pickup.code, delivery.code]));
    expect(recipientCodes(orders, 'pickup')).toEqual([pickup.code]);
    expect(recipientCodes(orders, 'delivery')).toEqual([delivery.code]);
  });
});

describe('hand-over lookup', () => {
  it('finds an order by a loosely typed code, and 404s a wrong one', async () => {
    const order = await place('pickup');
    const typed = ` ${formatOrderCode(order.code).toLowerCase()} `.trim();
    const found = await call('GET', `/api/seller/orders/${typed}`);
    expect(parseSellerOrderResponse(found.body)?.order.code).toBe(order.code);
    expect((await call('GET', '/api/seller/orders/ABC')).status).toBe(404);
    expect((await call('GET', '/api/seller/orders/ZZZZZZ')).status).toBe(404);
  });
});
