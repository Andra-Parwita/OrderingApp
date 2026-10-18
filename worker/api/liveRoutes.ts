// The two live WebSocket doors (plan 074): a customer's socket under /api/s/:slug/live and the
// seller's under LIVE_PATH. Split out of routes.ts (plan 098 C1).
import { DEFAULT_SELLER_SLUG } from '../../shared/seller';
import { LIVE_PATH } from '../../shared/liveContract';
import { TOKENS_MAX } from '../../shared/limits';
import { isFinalStatus } from '../../shared/status';
import { sessionTokenOf } from '../auth/cookie';
import type { Repository, SellerRepository } from '../repo/Repository';
import { error } from './respond';
import { noSeller, type ApiCall } from './routeKit';

/**
 * Plan 074: a customer's live socket. The private order tokens are the only credential (never a
 * name or phone): each must belong to THIS kitchen, be on its active menu and not be finished.
 * Only the codes of those orders reach the room, so the socket hears about nothing else.
 */
export async function customerSocket(
  call: ApiCall,
  sellerStore: SellerRepository,
): Promise<Response> {
  const { store, request, context, searchParams, bad } = call;
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket', { status: 426 });
  }
  if (!context.live) return error('not_found', 'Live updates are not available here');
  const raw = searchParams.get('tokens');
  if (raw === null) return bad();
  const tokens = [...new Set(raw.split(',').filter((token) => token !== ''))];
  if (tokens.length === 0 || tokens.length > TOKENS_MAX) return bad();
  const found = await store.lookupByTokens(tokens);
  const codes: Array<string> = [];
  for (const token of tokens) {
    const hit = found.get(token);
    if (
      hit?.kind === 'live' &&
      hit.sellerRepo.seller.id === sellerStore.seller.id &&
      !isFinalStatus(hit.order.status)
    ) {
      codes.push(hit.order.code);
    }
  }
  if (codes.length === 0) return error('not_found', 'No active orders');
  return context.live.connectCustomer(sellerStore.seller.id, codes);
}

/**
 * The seller behind a live socket. Same rules as the seller routes: a session wins (a seller or a
 * chef, never an admin or a half-set-up account); without one, DEV_TOOLS falls back to the
 * X-Seller header or a `?seller=` slug (a browser WebSocket cannot set headers).
 *
 * The real gate is the HttpOnly cookie session (stage 8.2), which a browser sends with the upgrade
 * request on its own. The slug fallback exists only with DEV_TOOLS. Events carry no customer data
 * either way.
 */
async function liveSeller(
  store: Repository,
  request: Request,
  searchParams: URLSearchParams,
  devTools: boolean,
): Promise<{ sellerId: string } | Response> {
  if (sessionTokenOf(request) !== undefined) {
    const caller = await store.auth.resolve(sessionTokenOf(request));
    if (!caller || caller.setup) return error('unauthorized', 'Sign in first');
    if (caller.role === 'admin') return error('forbidden', 'Admins have no order data');
    const sellerStore = caller.sellerId ? await store.sellerById(caller.sellerId) : undefined;
    if (!sellerStore) return error('unauthorized', 'Sign in first');
    return { sellerId: sellerStore.seller.id };
  }
  if (!devTools) return error('unauthorized', 'Sign in first');
  const slug = request.headers.get('X-Seller')?.trim() || searchParams.get('seller')?.trim();
  const sellerStore = await store.sellerBySlug(slug || DEFAULT_SELLER_SLUG);
  return sellerStore ? { sellerId: sellerStore.seller.id } : noSeller();
}

/** The seller's own live socket (LIVE_PATH). `undefined` means "not this path". */
export async function sellerSocket(call: ApiCall): Promise<Response | null | undefined> {
  const { store, request, context, pathname, searchParams } = call;
  if (pathname !== LIVE_PATH) return undefined;
  if (request.method !== 'GET') return null;
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket', { status: 426 });
  }
  if (!context.live) return error('not_found', 'Live updates are not available here');
  const who = await liveSeller(store, request, searchParams, context.devTools === true);
  if (who instanceof Response) return who;
  return context.live.connect(who.sellerId);
}
