// Mock API routes on standard Request/Response; shared by the dev Worker and the MSW handlers.
import { parseSampleOrdersRequest } from '../../shared/devContract';
import type { ApiErrorBody, ApiErrorCode } from '../../shared/apiError';
import type { StaffActor } from '../../shared/domain';
import {
  parseCreateOrderRequest,
  parseUpdateOrderRequest,
  type OrderResponse,
  type OrdersResponse,
} from '../../shared/orderContract';
import { parseOrderCode } from '../../shared/orderCode';
import { parseSetPaidRequest, parseSetStatusRequest } from '../../shared/sellerContract';
import type { MockStore, StoreResult } from './store';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unknown_item: 400,
  not_found: 404,
  cutoff_passed: 409,
  week_not_published: 409,
  sold_out: 409,
  exceeds_remaining: 409,
  invalid_status: 409,
};

function error(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: code, message };
  return Response.json(body, { status: STATUS[code] });
}

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

async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return undefined;
  }
}

function orderResult(result: StoreResult<OrderResponse['order']>, status = 200): Response {
  if (!result.ok) return error(result.error, result.message);
  const body: OrderResponse = { order: result.value };
  return Response.json(body, { status });
}

/** Returns null when no mock route matches, so the caller can fall through. */
export async function handleMockRequest(
  store: MockStore,
  request: Request,
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const method = request.method;
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'api') return null;
  const [, area, a, b, c] = segments;
  const bad = () => error('invalid_request', 'Invalid request');

  if (area === 'menu' && !a && method === 'GET') return Response.json(store.getMenu());

  if (area === 'orders') {
    if (!a && method === 'POST') {
      const input = parseCreateOrderRequest(await readJson(request));
      return input ? orderResult(store.createOrder(input), 201) : bad();
    }
    if (a && !b) {
      if (method === 'GET') {
        const order = store.getByToken(a);
        return order
          ? Response.json({ order } satisfies OrderResponse)
          : error('not_found', 'Order not found');
      }
      if (method === 'PATCH') {
        const patch = parseUpdateOrderRequest(await readJson(request));
        return patch ? orderResult(store.updateOrder(a, patch)) : bad();
      }
    }
    if (a && b === 'cancel' && !c && method === 'POST') return orderResult(store.cancelOrder(a));
    return null;
  }

  if (area === 'seller' && a === 'orders') {
    const actor = actorOf(request);
    if (!b && method === 'GET') {
      return Response.json({ orders: store.listOrders() } satisfies OrdersResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateOrderRequest(await readJson(request));
      return input ? orderResult(store.createSellerOrder(input, actor), 201) : bad();
    }
    const code = b ? parseOrderCode(b) : null;
    if (b && !c && method === 'GET') {
      const order = code ? store.getByCode(code) : undefined;
      return order
        ? Response.json({ order } satisfies OrderResponse)
        : error('not_found', 'Order not found');
    }
    if (b && c === 'status' && method === 'POST') {
      const input = parseSetStatusRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? orderResult(store.setStatus(code, input.to, actor))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'paid' && method === 'POST') {
      const input = parseSetPaidRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? orderResult(store.setPaid(code, input.paid, actor))
        : error('not_found', 'Order not found');
    }
    return null;
  }

  if (area === 'dev' && method === 'POST') {
    if (a === 'sample-orders') {
      const input = parseSampleOrdersRequest(await readJson(request));
      return input ? Response.json({ added: store.addSampleOrders(input.count) }) : bad();
    }
    if (a === 'reset') {
      store.reset();
      return Response.json({ ok: true });
    }
  }
  return null;
}
