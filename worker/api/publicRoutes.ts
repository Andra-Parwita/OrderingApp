// The routes anyone may call, no session: the status and notes every screen polls, the maintenance
// switch (a release token), a kitchen's public menu and order form (/api/s/:slug/*), and the push
// key. Split out of routes.ts (plan 098 C1). Role: anonymous (and so everyone).
import type { StatusResponse } from '../../shared/maintenance';
import { parseTokenSwitch } from '../../shared/maintenance';
import { reaches, type NotesResponse } from '../../shared/shortMessage';
import {
  ORDER_LOOKUP_MAX_FAILS,
  ORDER_LOOKUP_MAX_FAILS_PER_CLIENT,
  type TeamNamesResponse,
} from '../../shared/authContract';
import { parseCreateOrderRequest, parseFindOrderRequest } from '../../shared/orderContract';
import type { FindOrderResponse } from '../../shared/orderContract';
import type { PublicKeyResponse } from '../../shared/pushContract';
import { sha256Hex } from '../db/crypto';
import { bustMaintenanceCache } from './maintenanceGuard';
import { placeCustomerOrder } from './customerOrder';
import { orderLimitResponse } from './orderLimit';
import { customerResult, storeAddress } from './routeAddresses';
import { afterOrderWrite, noSeller, type ApiCall } from './routeKit';
import { customerSocket } from './liveRoutes';
import { authError, error, readJson } from './respond';

/**
 * Before the maintenance guard: the public status (cheap, cached a few seconds), the short messages
 * and the release-token switch. `undefined` means "not mine, carry on".
 */
export async function statusRoutes(call: ApiCall): Promise<Response | undefined> {
  const { store, request, context, searchParams, area, a, bad } = call;
  const method = request.method;
  // Plan 046: the public status (cheap, cached a few seconds) every screen polls.
  if (area === 'status' && !a && method === 'GET') {
    const state = await store.settings.maintenance();
    const backupMinutes = await store.settings.backupMinutes();
    return Response.json(
      { ...state, time: new Date().toISOString(), backupMinutes } satisfies StatusResponse,
      { headers: { 'Cache-Control': 'public, max-age=5' } },
    );
  }
  // Plan 086: the short messages a page may show now. The page names its side (sellers or
  // customers) and the kitchens it knows (a seller's own, or the customer's page and saved orders).
  if (area === 'notes' && !a && method === 'GET') {
    const side = searchParams.get('audience');
    if (side !== 'sellers' && side !== 'customers') return bad();
    const slugs = (searchParams.get('kitchens') ?? '').split(',').filter(Boolean).slice(0, 12);
    const ids: Array<string> = [];
    for (const slug of slugs) {
      const found = await store.sellerBySlug(slug);
      if (found) ids.push(found.seller.id);
    }
    const notes = (await store.messages.active())
      .filter((message) => reaches(message, side, ids))
      .map(({ id, textEn, textId, expiresAt }) => ({ id, textEn, textId, expiresAt }));
    return Response.json({ notes } satisfies NotesResponse, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  // Plan 046: the release token switches maintenance without a passkey; it works on this route only.
  if (area === 'maintenance' && !a && method === 'POST') {
    const sent = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    const wanted = context.maintenanceToken;
    if (!wanted || !sent || (await sha256Hex(sent)) !== (await sha256Hex(wanted))) {
      return error('unauthorized', 'Not allowed');
    }
    const on = parseTokenSwitch(await readJson(request));
    if (on === null) return bad();
    const saved = await store.settings.setMaintenance({ maintenance: on });
    bustMaintenanceCache();
    return Response.json(saved);
  }
  return undefined;
}

/**
 * Public, per seller (D-037): /api/s/:slug/*. The old unscoped GET /api/menu and POST /api/orders
 * are gone: they fall through (404). Called only when the area is `s` and a slug is given.
 */
export async function kitchenPublicRoutes(call: ApiCall): Promise<Response | null> {
  const { store, request, context, a, b, c, bad } = call;
  const method = request.method;
  const sellerStore = await store.sellerBySlug(a as string);
  if (!sellerStore) return noSeller();
  if (b === 'menu' && !c && method === 'GET') {
    const menu = await sellerStore.getMenu();
    return Response.json({
      ...menu,
      ...(context.addressKey ? { addresses: true } : {}),
      // Plan 076: the pickup map needs the key too, so it no longer waits for delivery addresses.
      ...(context.mapsEmbedKey ? { mapsEmbedKey: context.mapsEmbedKey } : {}),
    });
  }
  if (b === 'live' && !c && method === 'GET') return customerSocket(call, sellerStore);
  if (b === 'orders' && !c && method === 'POST') {
    const input = parseCreateOrderRequest(await readJson(request));
    if (!input) return bad();
    const tooMany = await orderLimitResponse(
      store,
      sellerStore.seller.id,
      request,
      context.devTools === true,
    );
    if (tooMany) return tooMany;
    const created = await placeCustomerOrder(store, sellerStore, request, input);
    await storeAddress(sellerStore, context, created, input.address);
    const result = await afterOrderWrite(context, sellerStore.seller.id, 'order.created', created);
    return customerResult(result, sellerStore, context, 201);
  }
  // D-075: a lost order back by code and first name, in this kitchen. Two wrong tries lock it for
  // 15 minutes per kitchen-and-code; ten lock a client address. Every miss answers alike.
  // Plan 033: the picker for password sign-in (names and ids of people who have a password).
  if (b === 'team-names' && !c && method === 'GET') {
    return Response.json({
      names: await store.auth.teamNames(sellerStore.seller.id),
    } satisfies TeamNamesResponse);
  }
  if (b === 'orders' && c === 'find' && method === 'POST') {
    const input = parseFindOrderRequest(await readJson(request));
    if (!input) return bad();
    // Only a hash of the address is kept: wrong-try rows (and so the hash) are swept by the hourly
    // cron once they are older than the lock time and not locked.
    const client = await store.auth.ipKey(request.headers.get('CF-Connecting-IP'));
    const perCode = `find:${sellerStore.seller.id}:${input.code}`;
    const wanted = input.firstName.toLowerCase();
    const found = await store.auth.guessLimited(
      {
        [`find:ip:${client}`]: ORDER_LOOKUP_MAX_FAILS_PER_CLIENT,
        [perCode]: ORDER_LOOKUP_MAX_FAILS,
      },
      [perCode],
      async () => {
        const order = await sellerStore.getByCode(input.code);
        return order && order.firstName.trim().toLowerCase() === wanted ? order.token : null;
      },
    );
    if (found.ok) return Response.json({ token: found.value } satisfies FindOrderResponse);
    return found.error === 'locked_out'
      ? authError(found)
      : error('not_found', 'No order found for that code and name');
  }
  return null;
}

/** The VAPID public key a browser needs to subscribe. 404 when push is not set up on this server. */
export function pushKeyRoute(call: ApiCall): Response | undefined {
  const { request, context, area, a, b } = call;
  if (area === 'push' && a === 'public-key' && !b && request.method === 'GET') {
    return context.vapidPublicKey
      ? Response.json({ publicKey: context.vapidPublicKey } satisfies PublicKeyResponse)
      : error('not_found', 'Notifications are not set up');
  }
  return undefined;
}
