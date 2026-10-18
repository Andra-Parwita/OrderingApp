// /api/seller/*: the day's orders and what goes with them (messages, updates, made counts, selling
// on the day, the orders CSV). Split out of routes.ts (plan 098 C1); roles are the allow-list (C2).
import {
  parseDeliveryStepRequest,
  parseMarkCollectedRequest,
  parseMessagePlaceRequest,
  parsePackRequest,
  type DeliveryStepResponse,
  type MessagePlaceResponse,
  type MessagesResponse,
} from '../../shared/handoverContract';
import {
  parseChangeFulfilmentRequest,
  parseCreateSellerOrderRequest,
  type SellerOrderResponse,
  type SellerOrdersResponse,
} from '../../shared/orderContract';
import { parseOrderCode } from '../../shared/orderCode';
import {
  parseForce,
  parseSetLockedRequest,
  parseSetPaidRequest,
  parseSetStatusRequest,
  parseSetWaReceivedRequest,
} from '../../shared/sellerContract';
import {
  parseSendUpdatesRequest,
  type SendUpdatesResponse,
  type UpdateResult,
} from '../../shared/updateContract';
import {
  parseDayCountRequest,
  parseDaySaleRequest,
  parseDayUndoRequest,
  type DayLogResponse,
  type DayStockResponse,
} from '../../shared/daySalesContract';
import { parseAddMadeRequest, type MadeResponse } from '../../shared/madeContract';
import { handleTranslate } from './translate';
import { error, readJson } from './respond';
import { afterOrderWrite, ownerOnly, refusal, sellerResult, signal } from './routeKit';
import { storeAddress } from './routeAddresses';
import {
  EVERYONE,
  OWNER_CHEF,
  OWNER_HELPER,
  route,
  type SellerCall,
  type SellerRoute,
} from './sellerRoute';

const notFound = () => error('not_found', 'Order not found');

/** Looks the order code in the path up, or answers 404. */
function withCode(call: SellerCall, then: (code: string) => Promise<Response>): Promise<Response> {
  const code = call.b ? parseOrderCode(call.b) : null;
  return code ? then(code) : Promise.resolve(notFound());
}

function dayCall(call: SellerCall): { accountId?: string; name: string; owner: boolean } {
  const { accountId, personName, actor } = call;
  return {
    ...(accountId ? { accountId } : {}),
    name: personName ?? actor.name,
    owner: actor.role === 'seller',
  };
}

export const SELLER_ORDER_ROUTES: ReadonlyArray<SellerRoute> = [
  route('POST', 'translate', OWNER_CHEF, (call) =>
    Promise.resolve(handleTranslate(call.request, call.sellerId, call.context.translate)),
  ),

  // plan 001 stage 4: messages. The log of the current menu, and a message to a pickup place.
  route('GET', 'messages', EVERYONE, async ({ store }) =>
    Response.json({ messages: await store.listMessages() } satisfies MessagesResponse),
  ),
  route('POST', 'messages/place/:id', OWNER_CHEF, async (call) => {
    const { store, request, c, bad, actor, context, sellerId } = call;
    const input = parseMessagePlaceRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.messagePlace(c as string, input, actor);
    if (!result.ok) return refusal(result);
    // Many orders changed (and `ready_now` moved some to Ready): the screens refetch.
    await signal(context, sellerId, 'order.changed');
    return Response.json(result.value satisfies MessagePlaceResponse);
  }),

  // Bulk updates to customers' inboxes (Saturday tools).
  route('POST', 'updates', OWNER_CHEF, async (call) => {
    const { store, request, bad, actor, context, sellerId } = call;
    const input = parseSendUpdatesRequest(await readJson(request));
    if (!input) return bad();
    const { codes, ...update } = input;
    // Forgiving codes ("k7f-2qx") are normalised first, so the same order is not sent twice.
    const unique = [...new Set(codes.map((code) => parseOrderCode(code) ?? code))];
    const results: Array<UpdateResult> = await store.sendUpdates(unique, update, actor);
    for (const entry of results)
      if (entry.ok) await signal(context, sellerId, 'order.changed', entry.code);
    return Response.json({
      results,
      sent: results.filter((entry) => entry.ok).length,
    } satisfies SendUpdatesResponse);
  }),

  // Plan 029 stage 2: selling on the day. Owners and helpers only; a chef gets 403.
  route('GET', 'day/log', OWNER_HELPER, async ({ store }) =>
    Response.json({ entries: await store.listDaySales() } satisfies DayLogResponse),
  ),
  route('POST', 'day/sale', OWNER_HELPER, async (call) => {
    const { store, request, bad, context, sellerId } = call;
    const input = parseDaySaleRequest(await readJson(request));
    if (!input) return bad();
    const sold = await store.sellOnDay(input, dayCall(call));
    if (!sold.ok) return refusal(sold);
    await signal(context, sellerId, 'stock.changed');
    return Response.json(sold.value satisfies DayStockResponse);
  }),
  route('POST', 'day/undo', OWNER_HELPER, async (call) => {
    const { store, request, bad, context, sellerId } = call;
    const input = parseDayUndoRequest(await readJson(request));
    if (!input) return bad();
    const undone = await store.undoDaySale(input, dayCall(call));
    if (!undone.ok) return refusal(undone);
    await signal(context, sellerId, 'stock.changed');
    return Response.json(undone.value satisfies DayStockResponse);
  }),
  route('POST', 'day/count', OWNER_HELPER, async (call) => {
    const { store, request, bad, context, sellerId } = call;
    const input = parseDayCountRequest(await readJson(request));
    if (!input) return bad();
    const set = await store.setDayCount(input, dayCall(call));
    if (!set.ok) return refusal(set);
    await signal(context, sellerId, 'stock.changed');
    return Response.json(set.value satisfies DayStockResponse);
  }),

  // Plan 035: shared made counts. Chefs cook, so chefs may write.
  route('GET', 'made', OWNER_CHEF, async ({ store }) => {
    const got = await store.getMade();
    return got.ok ? Response.json({ made: got.value } satisfies MadeResponse) : refusal(got);
  }),
  route('POST', 'made', OWNER_CHEF, async ({ store, request, bad, context, sellerId }) => {
    const input = parseAddMadeRequest(await readJson(request));
    if (!input) return bad();
    const added = await store.addMade(input);
    if (!added.ok) return refusal(added);
    await signal(context, sellerId, 'order.changed');
    return Response.json({ made: added.value } satisfies MadeResponse);
  }),

  route('GET', 'orders.csv', OWNER_CHEF, async ({ store }) => {
    return new Response(await store.ordersCsv(), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${store.seller.slug}.csv"`,
      },
    });
  }),

  // The orders themselves. A helper reads them and moves one along (status, collected, "Got it" on
  // a changed address); the rest is owner and chef.
  route(
    'GET',
    'orders',
    EVERYONE,
    async ({ store }) =>
      Response.json({ orders: await store.listOrders() } satisfies SellerOrdersResponse),
    { addresses: true },
  ),
  route(
    'POST',
    'orders',
    OWNER_CHEF,
    async ({ store, request, bad, actor, context, sellerId }) => {
      const input = parseCreateSellerOrderRequest(await readJson(request));
      if (!input) return bad();
      const created = await store.createSellerOrder(input, actor);
      await storeAddress(store, context, created, input.address);
      const result = await afterOrderWrite(context, sellerId, 'order.created', created);
      return sellerResult(result, 201);
    },
    { addresses: true },
  ),
  route(
    'GET',
    'orders/:code',
    EVERYONE,
    async ({ store, b }) => {
      const code = b ? parseOrderCode(b) : null;
      const order = code ? await store.getByCode(code) : undefined;
      return order
        ? Response.json({ order } satisfies SellerOrderResponse)
        : error('not_found', 'Order not found');
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/status',
    EVERYONE,
    async (call) => {
      const { store, request, bad, actor, changed } = call;
      const input = parseSetStatusRequest(await readJson(request));
      if (!input) return bad();
      const code = call.b ? parseOrderCode(call.b) : null;
      // Plan 081: on a private order only the owner cancels (others move it along).
      if (input.to === 'cancelled' && code && actor.role !== 'seller') {
        if (await store.getPrivate(code)) return ownerOnly();
      }
      return code
        ? sellerResult(
            await changed(await store.setStatus(code, input.to, actor, input.force === true)),
          )
        : notFound();
    },
    { addresses: true },
  ),
  // Plan 083: the seller (owner or chef; a helper may not) switches pickup <-> delivery.
  route(
    'PATCH',
    'orders/:code/fulfilment',
    OWNER_CHEF,
    async (call) => {
      const { store, request, bad, actor, context, changed } = call;
      const input = parseChangeFulfilmentRequest(await readJson(request));
      if (!input) return bad();
      const code = call.b ? parseOrderCode(call.b) : null;
      if (!code) return notFound();
      const result = await store.changeFulfilment(code, input, actor);
      // Pickup clears the address (null); delivery stores the typed one, encrypted (D-099).
      await storeAddress(
        store,
        context,
        result,
        input.fulfilment === 'pickup' ? null : input.address,
      );
      return sellerResult(await changed(result));
    },
    { addresses: true },
  ),
  // Plan 071: "Delete address now". A helper may not.
  route(
    'POST',
    'orders/:code/delete-address',
    OWNER_CHEF,
    async ({ store, b, context, sellerId }) => {
      const code = b ? parseOrderCode(b) : null;
      const order = code ? await store.getByCode(code) : undefined;
      if (!order) return notFound();
      await store.setOrderAddress(order.id, null);
      await signal(context, sellerId, 'order.changed', order.code);
      return sellerResult({ ok: true, value: order });
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/pack',
    OWNER_CHEF,
    async ({ store, request, b, bad, context, sellerId }) => {
      const input = parsePackRequest(await readJson(request));
      if (!input) return bad();
      // The signal carries only the code, for the seller's other screens; a customer's view of the
      // order does not change (D-066).
      const code = b ? parseOrderCode(b) : null;
      const result = code ? await store.packOrder(code, input) : null;
      if (!result) return notFound();
      if (result.ok) await signal(context, sellerId, 'order.changed', result.value.code);
      return sellerResult(result);
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/delivery-step',
    OWNER_CHEF,
    async ({ store, request, b, bad, actor, context, sellerId }) => {
      const input = parseDeliveryStepRequest(await readJson(request));
      if (!input) return bad();
      const code = b ? parseOrderCode(b) : null;
      if (!code) return notFound();
      const result = await store.deliveryStep(code, input, actor);
      if (!result.ok) return refusal(result);
      await signal(context, sellerId, 'order.changed', code);
      return Response.json(result.value satisfies DeliveryStepResponse);
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/collected',
    EVERYONE,
    async (call) => {
      const { store, request, bad, actor, changed } = call;
      const input = parseMarkCollectedRequest(await readJson(request));
      if (!input) return bad();
      return withCode(call, async (code) =>
        sellerResult(await changed(await store.markCollected(code, input, actor))),
      );
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/paid',
    OWNER_CHEF,
    async (call) => {
      const { store, request, bad, actor, changed } = call;
      const input = parseSetPaidRequest(await readJson(request));
      if (!input) return bad();
      const code = call.b ? parseOrderCode(call.b) : null;
      // Plan 081: on a private order only the owner changes paid.
      if (code && actor.role !== 'seller' && (await store.getPrivate(code))) return ownerOnly();
      return code
        ? sellerResult(await changed(await store.setPaid(code, input.paid, actor)))
        : notFound();
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/lock',
    OWNER_CHEF,
    async (call) => {
      const { store, request, bad, changed } = call;
      const input = parseSetLockedRequest(await readJson(request));
      if (!input) return bad();
      return withCode(call, async (code) =>
        sellerResult(await changed(await store.setLocked(code, input.locked))),
      );
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/wa-received',
    OWNER_CHEF,
    async (call) => {
      const { store, request, bad, changed } = call;
      const input = parseSetWaReceivedRequest(await readJson(request));
      if (!input) return bad();
      return withCode(call, async (code) =>
        sellerResult(await changed(await store.setWaReceived(code, input.received))),
      );
    },
    { addresses: true },
  ),
  route(
    'POST',
    'orders/:code/address-seen',
    EVERYONE,
    (call) =>
      withCode(call, async (code) =>
        sellerResult(await call.changed(await call.store.markAddressSeen(code))),
      ),
    { addresses: true },
  ),
  route('POST', 'orders/:code/nudge', OWNER_CHEF, (call) => nudgeOrSeen(call, 'nudge'), {
    addresses: true,
  }),
  route('POST', 'orders/:code/seen', OWNER_CHEF, (call) => nudgeOrSeen(call, 'seen'), {
    addresses: true,
  }),
];

async function nudgeOrSeen(call: SellerCall, which: 'nudge' | 'seen'): Promise<Response> {
  const { store, request, b, bad, changed } = call;
  const code = b ? parseOrderCode(b) : null;
  if (!code) return notFound();
  const force = which === 'nudge' ? parseForce(await readJson(request)) : false;
  if (force === null) return bad();
  return sellerResult(
    await changed(which === 'nudge' ? await store.nudge(code, force) : await store.markSeen(code)),
  );
}
