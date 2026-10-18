// /api/seller/*: who is calling, which kitchen they are in, and the dispatch table that carries
// every seller route with its allowed roles (plan 098 C1 + C2). The routes themselves live in
// menuRoutes, sellerOrderRoutes, privateRoutes and settingsRoutes.
import type { StaffActor } from '../../shared/domain';
import { DEVICE_ID_HEADER, parseDeviceId } from '../../shared/liveContract';
import { sessionTokenOf } from '../auth/cookie';
import type { SellerRepository } from '../repo/Repository';
import { error } from './respond';
import { actorOf, sellerSlugOf } from './devRoutes';
import { withAddresses } from './routeAddresses';
import { afterOrderWrite, noSeller, signal, type ApiCall, type RouteContext } from './routeKit';
import { MENU_ROUTES } from './menuRoutes';
import { PRIVATE_ROUTES } from './privateRoutes';
import { SELLER_ORDER_ROUTES } from './sellerOrderRoutes';
import { findRoute, type SellerCall, type SellerRole, type SellerRoute } from './sellerRoute';
import { SETTINGS_ROUTES } from './settingsRoutes';

/** The dispatch table: first match wins. Nothing here overlaps, so the order only reads well. */
export const SELLER_ROUTES: ReadonlyArray<SellerRoute> = [
  ...MENU_ROUTES,
  ...SELLER_ORDER_ROUTES,
  ...SETTINGS_ROUTES,
  ...PRIVATE_ROUTES,
];

type Who = {
  sellerStore: SellerRepository;
  role: SellerRole;
  actor: StaffActor;
  accountId?: string;
  chefId?: string;
  displayName?: string;
};

/** Finds the route, checks the caller's role against it, and runs it. */
async function dispatch(call: ApiCall, who: Who): Promise<Response | null> {
  const { store, request, context, a, b, c, bad } = call;
  const { sellerStore, role, actor } = who;
  const build = (ctx: RouteContext): SellerCall => {
    const sellerId = sellerStore.seller.id;
    return {
      repo: store,
      store: sellerStore,
      request,
      b,
      c,
      bad,
      actor,
      context: ctx,
      sellerId,
      accountId: who.accountId,
      chefId: who.chefId,
      personName: who.displayName,
      changed: (result) => afterOrderWrite(ctx, sellerId, 'order.changed', result),
      menuChanged: () => signal(ctx, sellerId, 'menu.changed'),
    };
  };
  const probe = build(context);
  const found = await findRoute(SELLER_ROUTES, request.method, a, b, c, probe);
  // Chefs and helpers are deny-by-default: a path with no route (or the wrong method on a real one)
  // is refused (403), not "not found". Only the owner learns that a route does not exist.
  if (role !== 'owner') {
    const refused = () =>
      error('forbidden', role === 'chef' ? 'Chefs cannot do this' : 'Helpers cannot do this');
    if (!found) return refused();
    const check = found.only?.[role];
    if (!found.roles.includes(role) || (check && !(await check(probe)))) return refused();
  }
  if (!found) return null;
  if (found.bare) return found.handler(probe);
  // Plan 074: the writer's device id rides on every live event this call causes.
  const from = parseDeviceId(request.headers.get(DEVICE_ID_HEADER));
  const live = context.live;
  const wrapped: RouteContext =
    from && live
      ? { ...context, live: { ...live, notify: (id, sig) => live.notify(id, { ...sig, from }) } }
      : context;
  const response = await found.handler(build(wrapped));
  return response && found.addresses ? withAddresses(response, sellerStore, wrapped) : response;
}

export async function sellerRoutes(call: ApiCall): Promise<Response | null> {
  const { store, request, context } = call;
  const token = sessionTokenOf(request);
  const caller = await store.auth.resolve(token);
  // A session wins over everything else: the seller (and the audit name) come from it, and a
  // different X-Seller / X-Actor header is ignored, so seller A can never act as seller B.
  if (token !== undefined) {
    if (!caller || caller.setup) return error('unauthorized', 'Sign in first');
    if (caller.role === 'admin') return error('forbidden', 'Admins have no order data');
    const sellerStore = caller.sellerId ? await store.sellerById(caller.sellerId) : undefined;
    if (!sellerStore) return error('unauthorized', 'Sign in first');
    const chefName =
      caller.role === 'chef' && caller.chefId
        ? (await sellerStore.listChefs()).find((chef) => chef.id === caller.chefId)?.name
        : undefined;
    if (caller.role === 'chef' && !chefName) return error('unauthorized', 'Sign in first');
    // Plan 028 (D-092): a helper is recorded as role `chef`, under their own display name.
    const actor: StaffActor =
      caller.role === 'chef'
        ? { role: 'chef', name: chefName as string }
        : caller.role === 'helper'
          ? { role: 'chef', name: caller.displayName ?? 'Helper' }
          : { role: 'seller', name: sellerStore.seller.name };
    const role: SellerRole =
      caller.role === 'chef' ? 'chef' : caller.role === 'helper' ? 'helper' : 'owner';
    return dispatch(call, {
      sellerStore,
      role,
      actor,
      accountId: caller.accountId,
      ...(caller.role === 'chef' && caller.chefId ? { chefId: caller.chefId } : {}),
      ...(caller.displayName ? { displayName: caller.displayName } : {}),
    });
  }
  // DEV_TOOLS only: without a session the X-Seller / X-Actor headers choose the seller and the
  // audit name, with full seller rights (no chef limits). Production answers 401.
  if (context.devTools !== true) return error('unauthorized', 'Sign in first');
  const sellerStore = await store.sellerBySlug(sellerSlugOf(request));
  if (!sellerStore) return noSeller();
  return dispatch(call, { sellerStore, role: 'owner', actor: actorOf(request) });
}
