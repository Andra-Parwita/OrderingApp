// The customer's own orders, by private token: /api/orders/*. The token is the credential and the
// order knows its seller, so these are global, not per kitchen. Split out of routes.ts (plan 098 C1).
// Role: anonymous (the token is the auth).
import { TOKENS_MAX } from '../../shared/limits';
import type { CustomerOrder } from '../../shared/domain';
import {
  parseUpdateOrderRequest,
  toArchivedOrder,
  toCustomerOrder,
  toExpiredOrder,
  type CustomerOrderResponse,
  type CustomerOrdersResponse,
  type ExpiredOrder,
  type FetchedOrderResponse,
} from '../../shared/orderContract';
import { parsePushSubscribeRequest, parsePushUnsubscribeRequest } from '../../shared/pushContract';
import { customerResult, storeAddress } from './routeAddresses';
import { afterOrderWrite, okResult, privateRefusal, weekClosed, type ApiCall } from './routeKit';
import { error, readJson } from './respond';

/** Called when the area is `orders`; always answers (null = no such route). */
export async function tokenOrderRoutes(call: ApiCall): Promise<Response | null> {
  const { store, request, context, searchParams, a, b, c, bad } = call;
  const method = request.method;
  if (!a && method === 'GET') {
    // My orders: GET /api/orders?tokens=a,b,c (unknown tokens are omitted; spans sellers).
    const raw = searchParams.get('tokens');
    if (raw === null) return bad();
    const tokens = [...new Set(raw.split(',').filter((token) => token !== ''))];
    if (tokens.length > TOKENS_MAX) return bad();
    const orders: Array<CustomerOrder> = [];
    const expired: Array<ExpiredOrder> = [];
    const found = await store.lookupByTokens(tokens);
    for (const token of tokens) {
      const hit = found.get(token);
      if (!hit) continue;
      if (hit.kind === 'live') orders.push(toCustomerOrder(hit.order, hit.sellerRepo.seller));
      else if (hit.kind === 'archived') {
        orders.push(toArchivedOrder(hit.order, hit.sellerRepo.seller, hit.cookingDate));
      } else expired.push(toExpiredOrder(token, hit.sellerRepo.seller, hit.cookingDate));
    }
    const body: CustomerOrdersResponse = { orders, ...(expired.length > 0 ? { expired } : {}) };
    return Response.json(body);
  }
  if (a && !b) {
    const hit = await store.lookupByToken(a);
    if (method === 'GET') {
      if (!hit) return error('not_found', 'Order not found');
      if (hit.kind === 'live') {
        return customerResult({ ok: true, value: hit.order }, hit.sellerRepo, context);
      }
      if (hit.kind === 'archived') {
        const order = toArchivedOrder(hit.order, hit.sellerRepo.seller, hit.cookingDate);
        return Response.json({ order } satisfies CustomerOrderResponse);
      }
      const expired = toExpiredOrder(a, hit.sellerRepo.seller, hit.cookingDate);
      return Response.json({ expired } satisfies FetchedOrderResponse);
    }
    if (method === 'PATCH') {
      const patch = parseUpdateOrderRequest(await readJson(request));
      if (!patch) return bad();
      if (!hit) return error('not_found', 'Order not found');
      if (hit.kind !== 'live') return weekClosed();
      if (hit.order.private) return privateRefusal();
      const updated = await hit.sellerRepo.updateOrder(a, patch, hit.order);
      const written = await storeAddress(hit.sellerRepo, context, updated, patch.address, true);
      const result = await afterOrderWrite(
        context,
        hit.sellerRepo.seller.id,
        'order.changed',
        updated,
      );
      // Re-read only when the address write marked the order (changed, "address changed"). The
      // address now stored is known (just written, or as the lookup read it): no read for it either.
      const fresh =
        result.ok && written?.edited ? await hit.sellerRepo.getByCode(result.value.code) : null;
      return customerResult(
        fresh ? { ok: true, value: fresh } : result,
        hit.sellerRepo,
        context,
        200,
        written ? written.stored : (hit.storedAddress ?? null),
      );
    }
  }
  // plan 001 stage 4: "I've collected it". The token is the auth, as on the order page. Idempotent.
  if (a && b === 'collected' && !c && method === 'POST') {
    const hit = await store.lookupByToken(a);
    if (!hit) return error('not_found', 'Order not found');
    if (hit.kind !== 'live') return weekClosed();
    if (hit.order.private) return privateRefusal();
    const result = await afterOrderWrite(
      context,
      hit.sellerRepo.seller.id,
      'order.changed',
      await hit.sellerRepo.customerCollected(a),
    );
    return customerResult(result, hit.sellerRepo, context);
  }
  // Plan 004 stage 6: web push for this order. The token is the auth; the browser's endpoint and
  // keys are stored and never returned. The Origin check sits in worker/auth/origin.ts.
  if (a && b === 'push' && !c && (method === 'POST' || method === 'DELETE')) {
    const hit = await store.lookupByToken(a);
    if (!hit) return error('not_found', 'Order not found');
    if (hit.kind !== 'live') return weekClosed();
    if (method === 'POST') {
      const input = parsePushSubscribeRequest(await readJson(request));
      if (!input) return bad();
      return okResult(await hit.sellerRepo.subscribePush(a, input));
    }
    const input = parsePushUnsubscribeRequest(await readJson(request));
    if (!input) return bad();
    return okResult(await hit.sellerRepo.unsubscribePush(a, input.endpoint));
  }
  if (a && b === 'cancel' && !c && method === 'POST') {
    const hit = await store.lookupByToken(a);
    if (!hit) return error('not_found', 'Order not found');
    if (hit.kind !== 'live') return weekClosed();
    if (hit.order.private) return privateRefusal();
    const result = await afterOrderWrite(
      context,
      hit.sellerRepo.seller.id,
      'order.changed',
      await hit.sellerRepo.cancelOrder(a, hit.order),
    );
    // Cancelling leaves the address as the lookup read it.
    return customerResult(result, hit.sellerRepo, context, 200, hit.storedAddress ?? null);
  }
  return null;
}
