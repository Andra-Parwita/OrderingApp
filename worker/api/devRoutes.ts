// DEV_TOOLS only: /api/dev/* and the header overrides that stand in for a session. In production
// (devTools off) the routes do not exist and the headers are ignored. Split out of routes.ts
// (plan 098 C1).
import {
  parseSampleOrdersRequest,
  type DevSellersResponse,
  type SampleOrdersResponse,
} from '../../shared/devContract';
import type { StaffActor } from '../../shared/domain';
import { DEFAULT_SELLER_SLUG } from '../../shared/seller';
import { readJson } from './respond';
import { noSeller, signal, type ApiCall } from './routeKit';

/** Header `X-Actor: seller:Bu Ani` or `chef:Wati`. */
const DEFAULT_ACTOR: StaffActor = { role: 'seller', name: 'Bu Ani' };

/** DEV_TOOLS only: the audit name comes from the X-Actor header when there is no session. */
export function actorOf(request: Request): StaffActor {
  const raw = request.headers.get('X-Actor');
  const index = raw?.indexOf(':') ?? -1;
  if (!raw || index < 0) return DEFAULT_ACTOR;
  const role = raw.slice(0, index);
  const name = raw.slice(index + 1).trim();
  if ((role !== 'seller' && role !== 'chef') || name === '') return DEFAULT_ACTOR;
  return { role, name };
}

/**
 * DEV_TOOLS only: which seller a request without a session is for, from the `X-Seller` slug
 * header (the dev seller picker). A session always decides the seller, never a header.
 */
export function sellerSlugOf(request: Request): string {
  const raw = request.headers.get('X-Seller')?.trim();
  return raw ? raw : DEFAULT_SELLER_SLUG;
}

/** Only called with DEV_TOOLS on. `null` = no such dev route. */
export async function devRoutes(call: ApiCall): Promise<Response | null> {
  const { store, request, context, a, b, bad } = call;
  const method = request.method;
  if (a === 'sellers' && !b && method === 'GET') {
    return Response.json({ sellers: await store.listSellers() } satisfies DevSellersResponse);
  }
  if (method === 'POST' && a === 'sample-orders') {
    const sellerStore = await store.sellerBySlug(sellerSlugOf(request));
    if (!sellerStore) return noSeller();
    const input = parseSampleOrdersRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.dev.addSampleOrders(sellerStore.seller.id, input.count);
    if (result.added > 0) await signal(context, sellerStore.seller.id, 'order.created');
    return Response.json(result satisfies SampleOrdersResponse);
  }
  if (method === 'POST' && a === 'reset') {
    await store.dev.reset();
    return Response.json({ ok: true });
  }
  return null;
}
