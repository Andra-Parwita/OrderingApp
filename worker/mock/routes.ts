// Mock API routes on standard Request/Response; shared by the dev Worker and the MSW handlers.
import { parseSampleOrdersRequest, type DevSellersResponse } from '../../shared/devContract';
import type { ApiErrorBody, ApiErrorCode } from '../../shared/apiError';
import type { SellerOrder, SellerRef, StaffActor } from '../../shared/domain';
import { TOKENS_MAX } from '../../shared/limits';
import {
  parseCreateOrderRequest,
  parseCreateSellerOrderRequest,
  parseUpdateOrderRequest,
  toCustomerOrder,
  type CustomerOrderResponse,
  type CustomerOrdersResponse,
  type SellerOrderResponse,
  type SellerOrdersResponse,
} from '../../shared/orderContract';
import { parseOrderCode } from '../../shared/orderCode';
import { DEFAULT_SELLER_SLUG } from '../../shared/seller';
import {
  parseSetLockedRequest,
  parseSetPaidRequest,
  parseSetStatusRequest,
  parseSetWaReceivedRequest,
  parseSettingsRequest,
  type SettingsResponse,
} from '../../shared/sellerContract';
import type { MockStore, SellerStore, StoreResult } from './store';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unknown_item: 400,
  not_found: 404,
  seller_not_found: 404,
  cutoff_passed: 409,
  week_not_published: 409,
  sold_out: 409,
  exceeds_remaining: 409,
  invalid_status: 409,
  order_locked: 409,
  ordering_closed: 409,
};

function error(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: code, message };
  return Response.json(body, { status: STATUS[code] });
}

const noSeller = () => error('seller_not_found', 'Seller not found');

/** Header `X-Actor: seller:Bu Ani` or `chef:Wati`. */
const DEFAULT_ACTOR: StaffActor = { role: 'seller', name: 'Bu Ani' };

/**
 * No auth yet (phase 4): the seller's identity comes from the X-Actor header, only so the audit
 * has someone to show. Replace with the real session in phase 4.
 */
function actorOf(request: Request): StaffActor {
  const raw = request.headers.get('X-Actor');
  const index = raw?.indexOf(':') ?? -1;
  if (!raw || index < 0) return DEFAULT_ACTOR;
  const role = raw.slice(0, index);
  const name = raw.slice(index + 1).trim();
  if ((role !== 'seller' && role !== 'chef') || name === '') return DEFAULT_ACTOR;
  return { role, name };
}

/**
 * Which seller a seller-side request is for: the `X-Seller` slug header. No auth yet: phase 4
 * replaces this with the signed-in session (the seller then comes from the session, never from a
 * header). Without the header the dev default is used, so the single-seller app keeps working
 * until stage 5.2 adds the dev seller picker.
 */
function sellerSlugOf(request: Request): string {
  const raw = request.headers.get('X-Seller')?.trim();
  return raw ? raw : DEFAULT_SELLER_SLUG;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return undefined;
  }
}

/** Seller endpoints return the full order. */
function sellerResult(result: StoreResult<SellerOrder>, status = 200): Response {
  if (!result.ok) return error(result.error, result.message);
  const body: SellerOrderResponse = { order: result.value };
  return Response.json(body, { status });
}

/** Customer endpoints return the narrowed view (with the seller), never the seller-only fields. */
function customerResult(
  result: StoreResult<SellerOrder>,
  seller: SellerRef,
  status = 200,
): Response {
  if (!result.ok) return error(result.error, result.message);
  const body: CustomerOrderResponse = { order: toCustomerOrder(result.value, seller) };
  return Response.json(body, { status });
}

/** Returns null when no mock route matches, so the caller can fall through. */
export async function handleMockRequest(
  store: MockStore,
  request: Request,
): Promise<Response | null> {
  const { pathname, searchParams } = new URL(request.url);
  const method = request.method;
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'api') return null;
  const [, area, a, b, c] = segments;
  const bad = () => error('invalid_request', 'Invalid request');

  // Public, per seller (D-037). The old unscoped GET /api/menu and POST /api/orders are gone:
  // they fall through (404).
  if (area === 's' && a) {
    const sellerStore = store.seller(a);
    if (!sellerStore) return noSeller();
    if (b === 'menu' && !c && method === 'GET') return Response.json(sellerStore.getMenu());
    if (b === 'orders' && !c && method === 'POST') {
      const input = parseCreateOrderRequest(await readJson(request));
      return input
        ? customerResult(sellerStore.createOrder(input), sellerStore.seller, 201)
        : bad();
    }
    return null;
  }

  // Customer endpoints by private token are global: the order knows its seller.
  if (area === 'orders') {
    if (!a && method === 'GET') {
      // My orders: GET /api/orders?tokens=a,b,c (unknown tokens are omitted; spans sellers).
      const raw = searchParams.get('tokens');
      if (raw === null) return bad();
      const tokens = [...new Set(raw.split(',').filter((token) => token !== ''))];
      if (tokens.length > TOKENS_MAX) return bad();
      const found = tokens.flatMap((token) => {
        const hit = store.findByToken(token);
        return hit ? [toCustomerOrder(hit.order, hit.store.seller)] : [];
      });
      const body: CustomerOrdersResponse = { orders: found };
      return Response.json(body);
    }
    if (a && !b) {
      const hit = store.findByToken(a);
      if (method === 'GET') {
        return hit
          ? customerResult({ ok: true, value: hit.order }, hit.store.seller)
          : error('not_found', 'Order not found');
      }
      if (method === 'PATCH') {
        const patch = parseUpdateOrderRequest(await readJson(request));
        if (!patch) return bad();
        return hit
          ? customerResult(hit.store.updateOrder(a, patch), hit.store.seller)
          : error('not_found', 'Order not found');
      }
    }
    if (a && b === 'cancel' && !c && method === 'POST') {
      const hit = store.findByToken(a);
      return hit
        ? customerResult(hit.store.cancelOrder(a), hit.store.seller)
        : error('not_found', 'Order not found');
    }
    return null;
  }

  if (area === 'seller') {
    const sellerStore = store.seller(sellerSlugOf(request));
    if (!sellerStore) return noSeller();
    return handleSeller(sellerStore, request, [a, b, c], bad);
  }

  if (area === 'dev') {
    if (a === 'sellers' && !b && method === 'GET') {
      return Response.json({ sellers: store.sellers() } satisfies DevSellersResponse);
    }
    if (method === 'POST' && a === 'sample-orders') {
      const sellerStore = store.seller(sellerSlugOf(request));
      if (!sellerStore) return noSeller();
      const input = parseSampleOrdersRequest(await readJson(request));
      return input ? Response.json({ added: sellerStore.addSampleOrders(input.count) }) : bad();
    }
    if (method === 'POST' && a === 'reset') {
      store.reset();
      return Response.json({ ok: true });
    }
  }
  return null;
}

/** Everything under /api/seller/*, for the one seller the request is scoped to. */
async function handleSeller(
  store: SellerStore,
  request: Request,
  [a, b, c]: [string | undefined, string | undefined, string | undefined],
  bad: () => Response,
): Promise<Response | null> {
  const method = request.method;
  if (a === 'menu' && !b && method === 'GET') return Response.json(store.getSellerMenu());

  if (a === 'settings' && !b) {
    const sellerId = store.seller.id;
    if (method === 'GET') {
      return Response.json({ sellerId, settings: store.getSettings() } satisfies SettingsResponse);
    }
    if (method === 'PUT') {
      const input = parseSettingsRequest(await readJson(request));
      return input
        ? Response.json({ sellerId, settings: store.setSettings(input) } satisfies SettingsResponse)
        : bad();
    }
    return null;
  }

  if (a === 'orders') {
    const actor = actorOf(request);
    if (!b && method === 'GET') {
      return Response.json({ orders: store.listOrders() } satisfies SellerOrdersResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateSellerOrderRequest(await readJson(request));
      return input ? sellerResult(store.createSellerOrder(input, actor), 201) : bad();
    }
    const code = b ? parseOrderCode(b) : null;
    if (b && !c && method === 'GET') {
      const order = code ? store.getByCode(code) : undefined;
      return order
        ? Response.json({ order } satisfies SellerOrderResponse)
        : error('not_found', 'Order not found');
    }
    if (b && c === 'status' && method === 'POST') {
      const input = parseSetStatusRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setStatus(code, input.to, actor))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'paid' && method === 'POST') {
      const input = parseSetPaidRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setPaid(code, input.paid, actor))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'lock' && method === 'POST') {
      const input = parseSetLockedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setLocked(code, input.locked))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'wa-received' && method === 'POST') {
      const input = parseSetWaReceivedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setWaReceived(code, input.received))
        : error('not_found', 'Order not found');
    }
    if (b && (c === 'nudge' || c === 'seen') && method === 'POST') {
      if (!code) return error('not_found', 'Order not found');
      return sellerResult(c === 'nudge' ? store.nudge(code) : store.markSeen(code));
    }
  }
  return null;
}
