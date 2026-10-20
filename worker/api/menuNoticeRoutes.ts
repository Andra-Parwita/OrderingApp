// New-menu notices (plan 112, D-113). Customers (anonymous, by kitchen slug): turn the notice on or
// off for this browser. The owner: the count and sends of the current menu, and Send. Chefs and
// helpers are refused by the roles list. The service is in the route context (Worker or tests).
import {
  parseMenuNoticeSendRequest,
  parseMenuNoticeSubscribeRequest,
  parseMenuNoticeUnsubscribeRequest,
} from '../../shared/menuNoticeContract';
import { error, readJson } from './respond';
import type { ApiCall } from './routeKit';
import { route, OWNER, type SellerRoute } from './sellerRoute';

const unavailable = () => error('not_found', 'Notices are not set up');

/** DELETE/POST /api/s/:slug/menu-notices. Called when `area` is `s` and `b` is `menu-notices`. */
export async function menuNoticeCustomerRoutes(call: ApiCall): Promise<Response | null> {
  const { store, request, context, a, c, bad } = call;
  const method = request.method;
  if (c || (method !== 'POST' && method !== 'DELETE')) return null;
  const sellerStore = await store.sellerBySlug(a as string);
  if (!sellerStore) return error('seller_not_found', 'Seller not found');
  const service = context.menuNotices;
  if (!service) return unavailable();
  const sellerId = sellerStore.seller.id;
  if (method === 'POST') {
    const input = parseMenuNoticeSubscribeRequest(await readJson(request));
    if (!input) return bad();
    const outcome = await service.subscribe(sellerId, input);
    return outcome === 'ok'
      ? Response.json({ ok: true })
      : error('invalid_request', 'Too many phones for this kitchen');
  }
  const input = parseMenuNoticeUnsubscribeRequest(await readJson(request));
  if (!input) return bad();
  await service.unsubscribe(sellerId, input.endpoint);
  return Response.json({ ok: true });
}

export const MENU_NOTICE_ROUTES: ReadonlyArray<SellerRoute> = [
  route('GET', 'menu-notices', OWNER, async ({ context, sellerId }) => {
    const service = context.menuNotices;
    return service ? Response.json(await service.status(sellerId)) : unavailable();
  }),

  route('POST', 'menu-notices/send', OWNER, async ({ context, request, sellerId, bad }) => {
    const service = context.menuNotices;
    if (!service) return unavailable();
    const input = parseMenuNoticeSendRequest(await readJson(request));
    if (!input) return bad();
    const outcome = await service.send(sellerId, input.again === true);
    if (outcome.kind === 'sent') return Response.json(outcome.status);
    // Two answers the contract's error codes do not list: the screen reads only the 409.
    return outcome.kind === 'not_open'
      ? Response.json(
          { error: 'not_open', message: 'Orders are not open for this menu' },
          { status: 409 },
        )
      : Response.json(
          {
            error: 'sent_twice',
            message: 'This menu already went out twice',
            sends: outcome.sends,
          },
          { status: 409 },
        );
  }),
];
