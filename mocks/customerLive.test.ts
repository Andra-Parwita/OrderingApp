// @vitest-environment node
// Plan 074: a customer's live socket. The private order tokens are the only credential; the Worker
// admits only active orders of THIS kitchen and the room sends a socket only those orders' events.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseCustomerOrderResponse } from '../shared/orderContract';
import { broadcast, broadcastToCustomers } from '../worker/live/hub';
import { devApi, useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const A = 'onde-onde';
const B = 'dapur-demo';

describe('customer live socket door', () => {
  const create = useWorld('customerLive');
  let world: World;
  let admitted: Array<{ sellerId: string; codes: ReadonlyArray<string> }>;
  let counter = 0;

  const live = {
    notify: () => Promise.resolve(),
    connect: () => Promise.resolve(new Response('seller')),
    connectCustomer(sellerId: string, codes: ReadonlyArray<string>) {
      admitted.push({ sellerId, codes });
      return Promise.resolve(new Response('customer-room'));
    },
  };

  async function call(
    method: string,
    path: string,
    body?: unknown,
    upgrade = false,
    extra: Record<string, string> = {},
  ) {
    const headers: Record<string, string> = { ...extra };
    if (upgrade) headers['Upgrade'] = 'websocket';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      { live },
    );
    if (!response) throw new Error('no route');
    return response;
  }

  async function place(name = 'Rina') {
    const reply = await call('POST', `/api/s/${A}/orders`, {
      firstName: name,
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    const order = parseCustomerOrderResponse(await reply.json())?.order;
    if (reply.status !== 201 || !order) throw new Error('could not place');
    return order;
  }

  beforeEach(async () => {
    counter = 0;
    admitted = [];
    world = await create({ now: () => NOW, newToken: () => `token-${String((counter += 1))}` });
  });

  it('admits the codes of the active orders behind the tokens, nothing else', async () => {
    const mine = await place('Rina');
    const other = await place('Tono');
    const reply = await call('GET', `/api/s/${A}/live?tokens=${mine.token}`, undefined, true);
    expect(reply.status).toBe(200);
    expect(admitted).toEqual([{ sellerId: 'seller-onde-onde', codes: [mine.code] }]);
    expect(admitted[0]?.codes).not.toContain(other.code);
  });

  it('refuses a token that belongs to another kitchen', async () => {
    const mine = await place();
    const reply = await call('GET', `/api/s/${B}/live?tokens=${mine.token}`, undefined, true);
    expect(reply.status).toBe(404);
    expect(admitted).toEqual([]);
  });

  it('refuses an unknown token and answers alike', async () => {
    const reply = await call('GET', `/api/s/${A}/live?tokens=nope`, undefined, true);
    expect(reply.status).toBe(404);
    expect(admitted).toEqual([]);
  });

  it('drops a finished order from the admitted codes (cancelled), and refuses when none is left', async () => {
    const first = await place('Rina');
    const second = await place('Tono');
    await call('POST', `/api/orders/${first.token}/cancel`);
    const both = `${first.token},${second.token}`;
    const reply = await call('GET', `/api/s/${A}/live?tokens=${both}`, undefined, true);
    expect(reply.status).toBe(200);
    expect(admitted[0]?.codes).toEqual([second.code]);
    await call('POST', `/api/orders/${second.token}/cancel`);
    const none = await call('GET', `/api/s/${A}/live?tokens=${both}`, undefined, true);
    expect(none.status).toBe(404);
    expect(admitted).toHaveLength(1);
  });

  it('C12: admits tokens sent in Sec-WebSocket-Protocol and answers with the marker only', async () => {
    const mine = await place('Rina');
    const other = await place('Tono');
    const protocol = `delave.live, tok.${mine.token}, tok.${other.token}`;
    const reply = await call('GET', `/api/s/${A}/live`, undefined, true, {
      'Sec-WebSocket-Protocol': protocol,
    });
    expect(reply.status).toBe(200);
    expect(reply.headers.get('Sec-WebSocket-Protocol')).toBe('delave.live');
    expect(admitted[0]?.codes).toEqual([mine.code, other.code]);
  });

  it('C12: the header wins over a stale ?tokens=, and an unknown header token is refused', async () => {
    const mine = await place('Rina');
    const refused = await call('GET', `/api/s/${A}/live?tokens=${mine.token}`, undefined, true, {
      'Sec-WebSocket-Protocol': 'delave.live, tok.nope',
    });
    expect(refused.status).toBe(404);
    expect(admitted).toEqual([]);
  });

  it('C12: the old ?tokens= form still works and sets no protocol header', async () => {
    const mine = await place('Rina');
    const reply = await call('GET', `/api/s/${A}/live?tokens=${mine.token}`, undefined, true);
    expect(reply.status).toBe(200);
    expect(reply.headers.get('Sec-WebSocket-Protocol')).toBeNull();
  });

  it('limits the tokens per socket and needs a WebSocket upgrade', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `t${String(i)}`).join(',');
    expect((await call('GET', `/api/s/${A}/live?tokens=${many}`, undefined, true)).status).toBe(
      400,
    );
    expect((await call('GET', `/api/s/${A}/live`, undefined, true)).status).toBe(400);
    expect((await call('GET', `/api/s/${A}/live?tokens=x`)).status).toBe(426);
  });
});

describe('customer events', () => {
  const NOW_D = new Date('2026-10-07T10:00:00Z');
  const socket = (codes: Array<string>) => {
    const frames: Array<string> = [];
    return { codes, frames, send: (data: string) => void frames.push(data) };
  };

  it('delivers an order change only to the sockets admitted with that code', () => {
    const mine = socket(['ABC123']);
    const other = socket(['ZZZ999']);
    const sent = broadcastToCustomers(
      [mine, other],
      { type: 'order.changed', code: 'ABC123' },
      NOW_D,
    );
    expect(sent).toBe(1);
    expect(mine.frames).toHaveLength(1);
    expect(JSON.parse(mine.frames[0] as string)).toEqual({
      type: 'order.changed',
      code: 'ABC123',
      at: NOW_D.toISOString(),
    });
    expect(other.frames).toEqual([]);
  });

  it('never sends the writer’s device id (`from`) to a customer, but sellers get it', () => {
    const mine = socket(['ABC123']);
    const signal = { type: 'order.changed', code: 'ABC123', from: 'a1b2c3d4e5f60718' } as const;
    expect(broadcastToCustomers([mine], signal, NOW_D)).toBe(1);
    expect(mine.frames[0]).not.toContain('from');
    expect(mine.frames[0]).not.toContain('a1b2c3d4e5f60718');
    const seller = socket([]);
    broadcast([seller], signal, NOW_D);
    expect(JSON.parse(seller.frames[0] as string)).toMatchObject({ from: 'a1b2c3d4e5f60718' });
  });

  it('never sends kitchen-wide events (created, menu, stock)', () => {
    const mine = socket(['ABC123']);
    for (const type of ['order.created', 'menu.changed', 'stock.changed'] as const) {
      expect(broadcastToCustomers([mine], { type, code: 'ABC123' }, NOW_D)).toBe(0);
    }
    expect(mine.frames).toEqual([]);
  });

  it('a change without a code is a bare nudge to every customer socket', () => {
    const one = socket(['A']);
    const two = socket(['B']);
    expect(broadcastToCustomers([one, two], { type: 'order.changed' }, NOW_D)).toBe(2);
    expect(JSON.parse(one.frames[0] as string)).toEqual({
      type: 'order.changed',
      at: NOW_D.toISOString(),
    });
  });

  it('skips a socket that closed under it', () => {
    const dead = {
      codes: ['A'],
      send: () => {
        throw new Error('closed');
      },
    };
    expect(broadcastToCustomers([dead], { type: 'order.changed', code: 'A' }, NOW_D)).toBe(0);
  });
});
