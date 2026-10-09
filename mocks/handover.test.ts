// @vitest-environment node
// Plan 001 stage 4: packing, messages to a pickup place, delivery steps, "collected", and the
// warn-never-block rule (D-062). Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import { parseBackupFile } from '../shared/backup';
import {
  parseDeliveryStepRequest,
  parseDeliveryStepResponse,
  parseMarkCollectedRequest,
  parseMessagePlaceRequest,
  parseMessagePlaceResponse,
  parseMessagesResponse,
  parsePackRequest,
} from '../shared/handoverContract';
import {
  parseCustomerOrderResponse,
  parseCreateOrderRequest,
  parseCreateSellerOrderRequest,
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
} from '../shared/orderContract';
import { parseSendUpdatesResponse } from '../shared/updateContract';
import type { SellerOrder } from '../shared/domain';
import { devApi, useWorld, type World } from './impl';

const START = new Date('2026-10-07T10:00:00Z');

describe('orders, packing and messages', () => {
  const create = useWorld('handover');
  let world: World;
  let current = START;
  let tokenCounter = 0;

  type Reply = { status: number; body: unknown };

  async function call(method: string, path: string, body?: unknown): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    if (!response) return { status: -1, body: null };
    return { status: response.status, body: await response.json() };
  }

  /** A customer order through the public route; returns the seller's view of it. */
  async function place(
    fulfilment: 'pickup' | 'delivery',
    name = 'Rina',
    extra: { pickupPlaceId?: string; lines?: Array<{ itemId: string; qty: number }> } = {},
  ): Promise<SellerOrder> {
    const reply = await call('POST', '/api/s/onde-onde/orders', {
      firstName: name,
      language: 'en',
      fulfilment,
      lines: extra.lines ?? [{ itemId: 'pesmol', qty: 1 }],
      ...(extra.pickupPlaceId !== undefined ? { pickupPlaceId: extra.pickupPlaceId } : {}),
    });
    if (reply.status !== 201) throw new Error(JSON.stringify(reply));
    const list = parseSellerOrdersResponse((await call('GET', '/api/seller/orders')).body);
    return list?.orders.find((order) => order.firstName === name) as SellerOrder;
  }

  async function orderOf(code: string): Promise<SellerOrder> {
    const parsed = parseSellerOrderResponse((await call('GET', `/api/seller/orders/${code}`)).body);
    return parsed?.order as SellerOrder;
  }

  const move = (code: string, to: string, force?: boolean) =>
    call('POST', `/api/seller/orders/${code}/status`, { to, ...(force ? { force } : {}) });
  const pack = (code: string, body: unknown) =>
    call('POST', `/api/seller/orders/${code}/pack`, body);
  const message = (placeId: string, body: unknown) =>
    call('POST', `/api/seller/messages/place/${placeId}`, body);
  const step = (code: string, body: unknown) =>
    call('POST', `/api/seller/orders/${code}/delivery-step`, body);
  const warningOf = (reply: Reply) => parseApiError(reply.body)?.warning?.code;

  beforeEach(async () => {
    tokenCounter = 0;
    current = START;
    world = await create({ now: () => current, newToken: () => `token-${String(++tokenCounter)}` });
  });

  describe('packing (D-066)', () => {
    it('ticks items and sets packed without touching status, inbox or updatedAt', async () => {
      const order = await place('pickup');
      await move(order.code, 'confirmed');
      const before = await orderOf(order.code);

      const ticked = parseSellerOrderResponse(
        (await pack(order.code, { ticked: ['pesmol'] })).body,
      );
      expect(ticked?.order.lines[0]?.ticked).toBe(true);
      expect(ticked?.order.packed).toBeUndefined();
      const packed = parseSellerOrderResponse((await pack(order.code, { packed: true })).body);
      expect(packed?.order.packed).toBe(true);

      const after = await orderOf(order.code);
      expect(after.packed).toBe(true);
      expect(after.lines[0]?.ticked).toBe(true);
      expect(after.status).toBe(before.status);
      expect(after.inbox).toEqual(before.inbox);
      expect(after.audit).toEqual(before.audit);
      expect(after.updatedAt).toBe(before.updatedAt);
    });

    it('never shows packing to the customer', async () => {
      const order = await place('pickup');
      await pack(order.code, { ticked: ['pesmol'], packed: true });
      const reply = await call('GET', `/api/orders/${order.token}`);
      expect(parseCustomerOrderResponse(reply.body)).not.toBeNull();
      const text = JSON.stringify(reply.body);
      expect(text.includes('packed')).toBe(false);
      expect(text.includes('ticked')).toBe(false);
    });

    it('warns about unticked items and goes ahead with force; clearing never warns', async () => {
      const order = await place('pickup', 'Rina', {
        lines: [
          { itemId: 'pesmol', qty: 1 },
          { itemId: 'lemper', qty: 2 },
        ],
      });
      const warned = await pack(order.code, { ticked: ['pesmol'], packed: true });
      expect(warned.status).toBe(409);
      expect(parseApiError(warned.body)?.warning).toEqual({
        code: 'items_unticked',
        unticked: ['lemper'],
        count: 1,
      });
      expect((await orderOf(order.code)).packed).toBeUndefined();
      expect((await orderOf(order.code)).lines.some((line) => line.ticked === true)).toBe(false);

      const forced = await pack(order.code, { ticked: ['pesmol'], packed: true, force: true });
      expect(forced.status).toBe(200);
      expect((await orderOf(order.code)).packed).toBe(true);

      const cleared = await pack(order.code, { packed: false });
      expect(cleared.status).toBe(200);
      expect((await orderOf(order.code)).packed).toBeUndefined();
    });

    it('packs once every item is ticked, and refuses ids that are not on the order', async () => {
      const order = await place('pickup');
      expect((await pack(order.code, { ticked: ['pesmol'], packed: true })).status).toBe(200);
      expect((await pack(order.code, { ticked: ['nope'] })).status).toBe(400);
      expect((await pack('ZZZZZZ', { packed: true })).status).toBe(404);
      expect((await pack(order.code, {})).status).toBe(400);
    });
  });

  describe('messages to a pickup place', () => {
    async function twoPlaces() {
      const reply = await call('PUT', '/api/seller/menus/current', {
        places: [{ placeId: 'glen-waverley' }, { placeId: 'box-hill' }],
      });
      expect(reply.status).toBe(200);
    }

    it('ready_in reaches the place only, with minutes, and changes no status', async () => {
      await twoPlaces();
      const a = await place('pickup', 'Ana', { pickupPlaceId: 'glen-waverley' });
      const b = await place('pickup', 'Budi'); // no place: counts as the first
      const c = await place('pickup', 'Cici', { pickupPlaceId: 'box-hill' });
      const d = await place('delivery', 'Dewi');
      const done = await place('pickup', 'Eka', { pickupPlaceId: 'glen-waverley' });
      for (const to of ['confirmed', 'ready_for_pickup', 'collected']) await move(done.code, to);

      const reply = await message('glen-waverley', { type: 'ready_in', minutes: 15 });
      expect(reply.status).toBe(200);
      const parsed = parseMessagePlaceResponse(reply.body);
      expect(parsed).toMatchObject({ sent: 2, readied: 0 });
      expect(parsed?.message).toMatchObject({
        group: 'place:glen-waverley',
        type: 'ready_in',
        minutes: 15,
        sentCount: 2,
      });

      for (const order of [a, b]) {
        const after = await orderOf(order.code);
        expect(after.status).toBe('ordered');
        expect(after.inbox[0]).toMatchObject({ kind: 'message', textKey: 'readyIn', minutes: 15 });
      }
      for (const order of [c, d, done]) {
        const after = await orderOf(order.code);
        expect(after.inbox.some((entry) => entry.textKey === 'readyIn')).toBe(false);
      }
    });

    it('ready_now sets those orders to Ready; ready_in does not', async () => {
      const a = await place('pickup', 'Ana');
      const b = await place('pickup', 'Budi');
      await move(a.code, 'confirmed');
      await move(b.code, 'confirmed');
      await message('glen-waverley', { type: 'ready_in', minutes: 10 });
      expect((await orderOf(a.code)).status).toBe('confirmed');

      current = new Date(current.getTime() + 30 * 60_000);
      const reply = await message('glen-waverley', { type: 'ready_now' });
      expect(parseMessagePlaceResponse(reply.body)).toMatchObject({ sent: 2, readied: 2 });
      for (const order of [a, b]) {
        const after = await orderOf(order.code);
        expect(after.status).toBe('ready_for_pickup');
        expect(after.inbox[0]).toMatchObject({ kind: 'status', status: 'ready_for_pickup' });
        expect(after.audit[0]).toMatchObject({ what: 'status', detail: 'ready_for_pickup' });
      }

      // Already Ready: told again, nothing to move.
      current = new Date(current.getTime() + 30 * 60_000);
      const again = await message('glen-waverley', { type: 'ready_now' });
      expect(parseMessagePlaceResponse(again.body)).toMatchObject({ sent: 2, readied: 0 });
      expect((await orderOf(a.code)).inbox[0]).toMatchObject({ kind: 'message', textKey: 'ready' });
    });

    it('sends a custom text in each customer language and logs it', async () => {
      const en = await place('pickup', 'Ana');
      const idOrder = await call('POST', '/api/s/onde-onde/orders', {
        firstName: 'Budi',
        language: 'id',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      });
      expect(idOrder.status).toBe(201);
      const reply = await message('glen-waverley', {
        type: 'custom',
        text: { en: 'Running late', id: 'Agak terlambat' },
      });
      expect(reply.status).toBe(200);
      const list = parseSellerOrdersResponse((await call('GET', '/api/seller/orders')).body);
      const budi = list?.orders.find((order) => order.firstName === 'Budi') as SellerOrder;
      expect((await orderOf(en.code)).inbox[0]).toMatchObject({ text: 'Running late' });
      expect(budi.inbox[0]).toMatchObject({ text: 'Agak terlambat' });
      const log = parseMessagesResponse((await call('GET', '/api/seller/messages')).body);
      expect(log?.messages[0]).toMatchObject({
        group: 'place:glen-waverley',
        type: 'custom',
        text: { en: 'Running late', id: 'Agak terlambat' },
        sentCount: 2,
      });
    });

    it('warns on a repeat within the window, then allows it with force or after the window', async () => {
      await place('pickup', 'Ana');
      expect((await message('glen-waverley', { type: 'ready_in', minutes: 15 })).status).toBe(200);
      const repeat = await message('glen-waverley', { type: 'ready_in', minutes: 20 });
      expect(repeat.status).toBe(409);
      expect(warningOf(repeat)).toBe('repeat_message');
      // The warning wrote nothing: one send in the log.
      const log = parseMessagesResponse((await call('GET', '/api/seller/messages')).body);
      expect(log?.messages).toHaveLength(1);
      // A different type is not a repeat.
      expect((await message('glen-waverley', { type: 'custom', text: { en: 'Hi' } })).status).toBe(
        200,
      );
      expect(
        (await message('glen-waverley', { type: 'ready_in', minutes: 20, force: true })).status,
      ).toBe(200);
      current = new Date(current.getTime() + 11 * 60_000);
      expect((await message('glen-waverley', { type: 'ready_in', minutes: 5 })).status).toBe(200);
    });

    it('warns when nobody is waiting, 404s a place that is not on the menu', async () => {
      await place('pickup', 'Ana');
      const none = await message('glen-waverley', { type: 'ready_now' });
      expect(none.status).toBe(200); // Ana is waiting
      current = new Date(current.getTime() + 60 * 60_000);
      await twoPlaces();
      const empty = await message('box-hill', { type: 'ready_in', minutes: 5 });
      expect(empty.status).toBe(409);
      expect(warningOf(empty)).toBe('nobody_to_message');
      expect(
        (await message('box-hill', { type: 'ready_in', minutes: 5, force: true })).status,
      ).toBe(200);
      expect((await message('nowhere', { type: 'ready_now' })).status).toBe(404);
    });

    it('is safe to retry: a failed later batch leaves no log row, and the retry reaches the rest only', async () => {
      const total = 52; // two batches of orders (50 + 2)
      for (let n = 0; n < total; n++) {
        const reply = await call('POST', '/api/s/onde-onde/orders', {
          firstName: `Cust${String(n)}`,
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        });
        expect(reply.status).toBe(201);
      }
      // The second batch that writes orders throws; everything else goes through.
      const d1 = world.db.d1;
      const realBatch = d1.batch.bind(d1);
      let writes = 0;
      d1.batch = (statements) => {
        const sqls = statements.map((s) => (s as unknown as { sql?: string }).sql ?? '');
        if (sqls.some((sql) => sql.startsWith('UPDATE orders SET status')) && ++writes === 2) {
          return Promise.reject(new Error('batch failed'));
        }
        return realBatch(statements);
      };
      try {
        await message('glen-waverley', { type: 'ready_now' }).catch(() => null);
      } finally {
        d1.batch = realBatch;
      }
      expect(writes).toBe(2);
      expect(
        parseMessagesResponse((await call('GET', '/api/seller/messages')).body)?.messages,
      ).toEqual([]);

      const retry = await message('glen-waverley', { type: 'ready_now' });
      expect(retry.status).toBe(200);
      expect(parseMessagePlaceResponse(retry.body)).toMatchObject({ sent: 2, readied: 2 });
      const log = parseMessagesResponse((await call('GET', '/api/seller/messages')).body);
      expect(log?.messages).toHaveLength(1);
      const orders = parseSellerOrdersResponse((await call('GET', '/api/seller/orders')).body);
      expect(orders?.orders).toHaveLength(total);
      for (const order of orders?.orders ?? []) {
        expect(order.status).toBe('ready_for_pickup');
        const readyLines = order.inbox.filter(
          (entry) =>
            (entry.kind === 'status' && entry.status === 'ready_for_pickup') ||
            entry.textKey === 'ready',
        );
        expect(readyLines).toHaveLength(1);
      }
    }, 60_000);

    it('takes no phone number or address in a message body', async () => {
      await place('pickup', 'Ana');
      for (const extra of [{ phone: '+61400000000' }, { address: '1 Main St' }]) {
        const reply = await message('glen-waverley', { type: 'ready_now', ...extra });
        expect(reply.status).toBe(400);
      }
    });
  });

  describe('delivery steps', () => {
    it('goes Out for delivery, Arriving soon, Delivered; each notifies and is logged', async () => {
      const order = await place('delivery');
      await move(order.code, 'confirmed');

      const out = parseDeliveryStepResponse(
        (await step(order.code, { step: 'out_for_delivery' })).body,
      );
      expect(out?.order.status).toBe('out_for_delivery');
      expect(out?.order.inbox[0]).toMatchObject({ kind: 'status', status: 'out_for_delivery' });
      expect(out?.message).toMatchObject({
        group: `order:${order.code}`,
        type: 'out_for_delivery',
      });

      const soon = parseDeliveryStepResponse(
        (await step(order.code, { step: 'arriving_soon', minutes: 20 })).body,
      );
      expect(soon?.order.status).toBe('out_for_delivery');
      expect(soon?.order.inbox[0]).toMatchObject({ textKey: 'arrivingIn', minutes: 20 });

      const done = parseDeliveryStepResponse((await step(order.code, { step: 'delivered' })).body);
      expect(done?.order.status).toBe('delivered');
      expect((await orderOf(order.code)).inbox[0]).toMatchObject({ status: 'delivered' });

      const log = parseMessagesResponse((await call('GET', '/api/seller/messages')).body);
      expect(log?.messages.map((entry) => entry.type)).toEqual([
        'delivered',
        'arriving_soon',
        'out_for_delivery',
      ]);
    });

    it('warns about a step out of order, a repeat, a pickup order and a closed order', async () => {
      const order = await place('delivery', 'Ana');
      // Still "ordered": Out for delivery comes after Confirmed.
      const early = await step(order.code, { step: 'out_for_delivery' });
      expect(early.status).toBe(409);
      expect(warningOf(early)).toBe('step_out_of_order');
      expect((await orderOf(order.code)).status).toBe('ordered');
      const forced = await step(order.code, { step: 'out_for_delivery', force: true });
      expect(forced.status).toBe(200);
      expect((await orderOf(order.code)).status).toBe('out_for_delivery');

      const repeat = await step(order.code, { step: 'out_for_delivery' });
      expect(warningOf(repeat)).toBe('step_repeated');

      const pickup = await place('pickup', 'Budi');
      const wrong = await step(pickup.code, { step: 'arriving_soon' });
      expect(wrong.status).toBe(409);
      expect(warningOf(wrong)).toBe('not_delivery');
      expect(parseApiError(wrong.body)?.error).toBe('invalid_status');

      await step(order.code, { step: 'delivered' });
      const closed = await step(order.code, { step: 'arriving_soon' });
      expect(warningOf(closed)).toBe('order_closed');
      expect((await step(order.code, { step: 'arriving_soon', force: true })).status).toBe(200);
    });

    it('rejects a bad step, minutes on the wrong step, and personal data', async () => {
      const order = await place('delivery');
      for (const bad of [
        { step: 'nope' },
        { step: 'delivered', minutes: 5 },
        { step: 'arriving_soon', minutes: 0 },
        { step: 'delivered', address: '1 Main St' },
        { step: 'delivered', phone: '0812' },
      ]) {
        expect((await step(order.code, bad)).status, JSON.stringify(bad)).toBe(400);
      }
      expect((await step('ZZZZZZ', { step: 'delivered' })).status).toBe(404);
    });
  });

  describe('collected', () => {
    it('lets the customer confirm a pickup, once (idempotent), and tells the seller', async () => {
      const order = await place('pickup');
      await move(order.code, 'confirmed');
      await move(order.code, 'ready_for_pickup');

      const first = await call('POST', `/api/orders/${order.token}/collected`);
      expect(first.status).toBe(200);
      expect(parseCustomerOrderResponse(first.body)?.order.status).toBe('collected');
      const after = await orderOf(order.code);
      expect(after.status).toBe('collected');
      expect(after.collectedBy).toBe('customer');
      expect(after.collectedAt).toBe(START.toISOString());
      expect(after.audit[0]).toMatchObject({ by: { role: 'customer' }, detail: 'collected' });

      current = new Date(current.getTime() + 60_000);
      const second = await call('POST', `/api/orders/${order.token}/collected`);
      expect(second.status).toBe(200);
      const again = await orderOf(order.code);
      expect(again.collectedAt).toBe(after.collectedAt);
      expect(again.inbox).toEqual(after.inbox);
      expect(again.audit).toEqual(after.audit);
      // The seller's quiet button after the customer: still the customer's confirmation.
      const quiet = await call('POST', `/api/seller/orders/${order.code}/collected`);
      expect(quiet.status).toBe(200);
      expect((await orderOf(order.code)).collectedBy).toBe('customer');
    });

    it('refuses the customer until the order is Ready, and leaves the order unchanged', async () => {
      const order = await place('pickup');
      for (const to of ['ordered', 'confirmed']) {
        if (to === 'confirmed') await move(order.code, 'confirmed');
        const before = await orderOf(order.code);
        const refused = await call('POST', `/api/orders/${order.token}/collected`);
        expect(refused.status).toBe(409);
        expect(parseApiError(refused.body)?.error).toBe('invalid_status');
        expect(await orderOf(order.code)).toEqual(before);
      }
      await move(order.code, 'ready_for_pickup');
      expect((await call('POST', `/api/orders/${order.token}/collected`)).status).toBe(200);
      expect((await orderOf(order.code)).status).toBe('collected');
      // A second tap is idempotent, not refused.
      expect((await call('POST', `/api/orders/${order.token}/collected`)).status).toBe(200);
    });

    it('refuses the customer on a delivery or a cancelled order, and 404s an unknown token', async () => {
      const delivery = await place('delivery', 'Ana');
      expect((await call('POST', `/api/orders/${delivery.token}/collected`)).status).toBe(409);
      const cancelled = await place('pickup', 'Budi');
      await move(cancelled.code, 'cancelled');
      expect((await call('POST', `/api/orders/${cancelled.token}/collected`)).status).toBe(409);
      expect((await call('POST', '/api/orders/nope/collected')).status).toBe(404);
    });

    it('lets the seller mark collected quietly, warning first when it is not ready', async () => {
      const order = await place('pickup');
      const early = await call('POST', `/api/seller/orders/${order.code}/collected`);
      expect(early.status).toBe(409);
      expect(warningOf(early)).toBe('not_ready');
      expect((await orderOf(order.code)).collectedAt).toBeUndefined();

      await move(order.code, 'confirmed');
      await move(order.code, 'ready_for_pickup');
      const marked = await call('POST', `/api/seller/orders/${order.code}/collected`);
      expect(marked.status).toBe(200);
      const after = await orderOf(order.code);
      expect(after.status).toBe('collected');
      expect(after.collectedBy).toBe('seller');
      expect(after.collectedAt).toBe(START.toISOString());

      const forced = await place('pickup', 'Budi');
      const reply = await call('POST', `/api/seller/orders/${forced.code}/collected`, {
        force: true,
      });
      expect(reply.status).toBe(200);
      expect((await orderOf(forced.code)).status).toBe('collected');
    });
  });

  describe('warn, never block (D-062)', () => {
    it('a status jump warns; force moves it', async () => {
      const order = await place('pickup');
      const jump = await move(order.code, 'collected');
      expect(jump.status).toBe(409);
      expect(parseApiError(jump.body)?.error).toBe('invalid_status');
      expect(warningOf(jump)).toBe('status_out_of_order');
      expect((await orderOf(order.code)).status).toBe('ordered');
      expect((await move(order.code, 'collected', true)).status).toBe(200);
      expect((await orderOf(order.code)).status).toBe('collected');
      // Out of a closed order too.
      expect(warningOf(await move(order.code, 'confirmed'))).toBe('status_out_of_order');
      expect((await move(order.code, 'confirmed', true)).status).toBe(200);
    });

    it('nudge warns on closed orders; force sends', async () => {
      const pickup = await place('pickup', 'Ana');
      await move(pickup.code, 'collected', true);
      const nudge = await call('POST', `/api/seller/orders/${pickup.code}/nudge`);
      expect(warningOf(nudge)).toBe('order_closed');
      expect(
        (await call('POST', `/api/seller/orders/${pickup.code}/nudge`, { force: true })).status,
      ).toBe(200);
    });

    it('bulk updates skip cancelled orders with a warning unless forced', async () => {
      const order = await place('pickup');
      await move(order.code, 'cancelled');
      const body = { template: 'arrived', codes: [order.code] };
      const skipped = parseSendUpdatesResponse(
        (await call('POST', '/api/seller/updates', body)).body,
      );
      expect(skipped?.sent).toBe(0);
      expect(skipped?.results[0]).toEqual({
        code: order.code,
        ok: false,
        error: 'invalid_status',
        warning: { code: 'order_cancelled' },
      });
      const sent = parseSendUpdatesResponse(
        (await call('POST', '/api/seller/updates', { ...body, force: true })).body,
      );
      expect(sent?.sent).toBe(1);
    });

    it('a seller-entered order over the portion limit warns; force enters it. Customers stay refused', async () => {
      const entry = {
        firstName: 'Walk-in',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'lemper', qty: 21 }],
      };
      const warned = await call('POST', '/api/seller/orders', entry);
      expect(warned.status).toBe(409);
      expect(parseApiError(warned.body)?.error).toBe('exceeds_remaining');
      expect(warningOf(warned)).toBe('over_limit');
      const forced = await call('POST', '/api/seller/orders', { ...entry, force: true });
      expect(forced.status).toBe(201);
      const customer = await call('POST', '/api/s/onde-onde/orders', {
        ...entry,
        firstName: 'Rina',
        lines: [{ itemId: 'lemper', qty: 1 }],
      });
      expect(customer.status).toBe(409);
      expect(parseApiError(customer.body)?.warning).toBeUndefined();
    });
  });

  describe('no phone numbers or addresses (D-059)', () => {
    it('refuses a phone or an address on any order request', () => {
      const order = {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      };
      expect(parseCreateOrderRequest(order)).not.toBeNull();
      for (const extra of [
        { phone: '+61400000000' },
        { phoneNumber: '0400' },
        { whatsapp: '0400' },
        { address: '1 Main St' },
        { deliveryAddress: '1 Main St' },
      ]) {
        expect(parseCreateOrderRequest({ ...order, ...extra })).toBeNull();
        expect(parseCreateSellerOrderRequest({ ...order, ...extra })).toBeNull();
      }
      for (const extra of [{ phone: '0400' }, { address: 'x' }]) {
        expect(parsePackRequest({ packed: true, ...extra })).toBeNull();
        expect(parseMessagePlaceRequest({ type: 'ready_now', ...extra })).toBeNull();
        expect(parseDeliveryStepRequest({ step: 'delivered', ...extra })).toBeNull();
        expect(parseMarkCollectedRequest({ ...extra })).toBeNull();
      }
    });

    it('refuses them over HTTP, and stores and exports none', async () => {
      const refused = await call('POST', '/api/s/onde-onde/orders', {
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'delivery',
        address: '1 Main St',
        phone: '+61400000000',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      });
      expect(refused.status).toBe(400);
      const order = await place('delivery');
      await step(order.code, { step: 'out_for_delivery', force: true });
      const exported = (await call('GET', '/api/seller/backup')).body;
      expect(JSON.stringify(exported).includes('61400000000')).toBe(false);
      const file = parseBackupFile(exported);
      const keys = new Set((file?.orders ?? []).flatMap((entry) => Object.keys(entry)));
      expect([...keys].filter((key) => /phone|address|whatsapp/i.test(key))).toEqual([]);
    });
  });

  describe('backup', () => {
    it('carries packing, collected, place and the log, optional on parse, and restores them', async () => {
      const a = await place('pickup', 'Ana', { pickupPlaceId: 'glen-waverley' });
      await pack(a.code, { ticked: ['pesmol'], packed: true });
      await move(a.code, 'confirmed');
      await move(a.code, 'ready_for_pickup');
      expect(
        (await message('glen-waverley', { type: 'custom', text: { en: 'Hello' } })).status,
      ).toBe(200);
      await call('POST', `/api/orders/${a.token}/collected`);

      const exported = (await call('GET', '/api/seller/backup')).body;
      const file = parseBackupFile(exported);
      expect(file).not.toBeNull();
      expect(file?.messageLog).toHaveLength(1);
      const exportedOrder = file?.orders.find((order) => order.code === a.code);
      expect(exportedOrder).toMatchObject({
        packed: true,
        collectedBy: 'customer',
        pickupPlaceId: 'glen-waverley',
      });
      expect(exportedOrder?.lines[0]?.ticked).toBe(true);

      // A file made before stage 4 (none of the new fields) still parses.
      const old = JSON.parse(JSON.stringify(exported)) as {
        messageLog?: unknown;
        orders: Array<Record<string, unknown> & { lines: Array<Record<string, unknown>> }>;
      };
      delete old.messageLog;
      for (const order of old.orders) {
        delete order['packed'];
        delete order['collectedAt'];
        delete order['collectedBy'];
        delete order['pickupPlaceId'];
        for (const line of order.lines) delete line['ticked'];
      }
      expect(parseBackupFile(old)).not.toBeNull();

      // Restore puts it all back.
      await call('POST', '/api/seller/orders/' + a.code + '/pack', { packed: false });
      expect((await call('POST', '/api/seller/backup', exported)).status).toBe(200);
      const restored = await orderOf(a.code);
      expect(restored.packed).toBe(true);
      expect(restored.collectedBy).toBe('customer');
      expect(restored.pickupPlaceId).toBe('glen-waverley');
      expect(restored.lines[0]?.ticked).toBe(true);
      const log = parseMessagesResponse((await call('GET', '/api/seller/messages')).body);
      expect(log?.messages).toHaveLength(1);
    });
  });
});
