// API routes on standard Request/Response; shared by the Worker and the MSW handlers.
//
// This file is only the dispatcher: it splits the path and hands the request to the area that owns
// it, in a fixed order. The areas (plan 098 C1): publicRoutes (status, notes, a kitchen's public
// menu and order form), orderTokenRoutes (a customer's own orders), liveRoutes (the two sockets),
// authRoutes / customerRoutes / logRoutes (sign-in, the optional customer passkey, client logs, and
// the admin), sellerRoutes with its table (menuRoutes, sellerOrderRoutes, privateRoutes,
// settingsRoutes), and devRoutes. Each /api/seller route lists the roles allowed to call it (C2).
import { error } from './respond';
import { handleAdmin, handleAuth } from './authRoutes';
import { handleCustomer } from './customerRoutes';
import { handleAdminLog, handleLog } from './logRoutes';
import { maintenanceOn } from './maintenanceGuard';
import { devRoutes } from './devRoutes';
import { sellerSocket } from './liveRoutes';
import { tokenOrderRoutes } from './orderTokenRoutes';
import { kitchenPublicRoutes, pushKeyRoute, statusRoutes } from './publicRoutes';
import type { ApiCall, RouteContext } from './routeKit';
import { sellerRoutes } from './sellerRoutes';
import type { Repository } from '../repo/Repository';

export type { RouteContext } from './routeKit';

/** Plan 046: these areas keep working in maintenance (the admin signs in and switches it off; client logs). */
const MAINTENANCE_EXEMPT = new Set(['admin', 'auth', 'log', 'maintenance']);

/** Returns null when no route matches, so the caller can fall through. */
export async function handleApiRequest(
  store: Repository,
  request: Request,
  context: RouteContext = {},
): Promise<Response | null> {
  const { pathname, searchParams } = new URL(request.url);
  const method = request.method;
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'api') return null;
  const [, area, a, b, c] = segments;
  const call: ApiCall = {
    store,
    request,
    context,
    pathname,
    searchParams,
    area,
    a,
    b,
    c,
    bad: () => error('invalid_request', 'Invalid request'),
  };

  const early = await statusRoutes(call);
  if (early) return early;
  // Plan 046: while maintenance is on, every change is refused so nothing is half-saved during a migration.
  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    area !== undefined &&
    !MAINTENANCE_EXEMPT.has(area) &&
    (await maintenanceOn(store))
  ) {
    return error('maintenance', 'The app is being updated. Back in a few minutes.');
  }

  if (area === 's' && a) return kitchenPublicRoutes(call);
  // Customer endpoints by private token are global: the order knows its seller.
  if (area === 'orders') return tokenOrderRoutes(call);
  const pushKey = pushKeyRoute(call);
  if (pushKey) return pushKey;

  if (area === 'log' && !a) return handleLog(store, request);
  if (area === 'auth') return handleAuth(store, request, [a, b]);
  if (area === 'customer') return handleCustomer(store, request, [a, b], searchParams);
  if (area === 'admin' && a === 'log' && !b) return handleAdminLog(store, request);
  if (area === 'admin')
    return handleAdmin(
      store,
      request,
      [a, b, c, segments[5], segments[6]],
      context.devTools === true,
      context.images,
      context.live,
    );

  const socket = await sellerSocket(call);
  if (socket !== undefined) return socket;
  if (area === 'seller') return sellerRoutes(call);
  if (area === 'dev' && context.devTools === true) return devRoutes(call);
  return null;
}
