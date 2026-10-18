// /api/seller/private/*: private (Khusus) orders, plan 081. Anyone on the team reads the list; the
// chef summary is income (owner and chef only); writes are the owner's. Split out of routes.ts
// (plan 098 C1); roles are the allow-list (C2).
import {
  isEventDate,
  parseCreatePrivateRequest,
  parseUpdatePrivateRequest,
  type PrivateChefSummaryResponse,
} from '../../shared/privateContract';
import { parseOrderCode } from '../../shared/orderCode';
import { error, readJson } from './respond';
import { afterOrderWrite, ownerOnly, sellerResult } from './routeKit';
import { storeAddress } from './routeAddresses';
import {
  EVERYONE,
  OWNER,
  OWNER_CHEF,
  route,
  type SellerCall,
  type SellerRoute,
} from './sellerRoute';

/** Owner only, whatever the caller's header: chefs and helpers are refused at the door, and a DEV_TOOLS call is checked as well. */
const notOwner = (call: SellerCall): boolean => call.actor.role !== 'seller';

export const PRIVATE_ROUTES: ReadonlyArray<SellerRoute> = [
  route(
    'GET',
    'private',
    EVERYONE,
    async ({ store, request, bad }) => {
      const params = new URL(request.url).searchParams;
      const view = params.get('view');
      if (view !== null && view !== 'upcoming' && view !== 'past') return bad();
      const day = params.get('day');
      if (day !== null && day !== 'today') return bad();
      return Response.json(
        await store.listPrivate({
          ...(view !== null ? { view } : {}),
          ...(day !== null ? { day } : {}),
          ...(params.get('due') === '1' ? { dueOnly: true } : {}),
        }),
      );
    },
    { addresses: true },
  ),
  route(
    'GET',
    'private/chef-summary',
    OWNER_CHEF,
    async ({ store, request, bad, chefId }) => {
      const date = new URL(request.url).searchParams.get('date');
      if (!isEventDate(date)) return bad();
      // Plan 069 rules: the owner sees every row; a chef only her own and only while the setting allows.
      const summary = await store.privateChefSummary(date, chefId);
      if (summary === 'private') return error('forbidden', 'The kitchen keeps income private');
      return Response.json(summary satisfies PrivateChefSummaryResponse);
    },
    { addresses: true },
  ),
  route(
    'POST',
    'private',
    OWNER,
    async (call) => {
      if (notOwner(call)) return ownerOnly();
      const { store, request, bad, actor, context, sellerId } = call;
      const input = parseCreatePrivateRequest(await readJson(request));
      if (!input) return bad();
      const created = await store.createPrivate(input, actor);
      await storeAddress(store, context, created, input.address);
      return sellerResult(await afterOrderWrite(context, sellerId, 'order.created', created), 201);
    },
    { addresses: true },
  ),
  route(
    'PATCH',
    'private/:code',
    OWNER,
    async (call) => {
      if (notOwner(call)) return ownerOnly();
      const { store, request, b, bad, actor, context, changed } = call;
      const input = parseUpdatePrivateRequest(await readJson(request));
      if (!input) return bad();
      const code = b ? parseOrderCode(b) : null;
      if (!code) return error('not_found', 'Order not found');
      const updated = await store.updatePrivate(code, input, actor);
      await storeAddress(store, context, updated, input.address);
      return sellerResult(await changed(updated));
    },
    { addresses: true },
  ),
  route(
    'POST',
    'private/:code/cancel',
    OWNER,
    async (call) => {
      if (notOwner(call)) return ownerOnly();
      const { store, b, actor, changed } = call;
      const code = b ? parseOrderCode(b) : null;
      if (!code) return error('not_found', 'Order not found');
      return sellerResult(await changed(await store.cancelPrivate(code, actor)));
    },
    { addresses: true },
  ),
];
