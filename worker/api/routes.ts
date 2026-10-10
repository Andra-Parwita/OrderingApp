// API routes on standard Request/Response; shared by the Worker and the MSW handlers.
import type { ApiErrorCode, ApiWarning } from '../../shared/apiError';
import {
  parseSampleOrdersRequest,
  type ClearSamplesResponse,
  type DevSellersResponse,
  type SampleOrdersResponse,
} from '../../shared/devContract';
import {
  parseDeliveryStepRequest,
  parseMarkCollectedRequest,
  parseMessagePlaceRequest,
  parsePackRequest,
  type DeliveryStepResponse,
  type MessagePlaceResponse,
  type MessagesResponse,
} from '../../shared/handoverContract';
import { parseBackupFile } from '../../shared/backup';
import type {
  Chef,
  CustomerOrder,
  SellerMenuItemView,
  SellerOrder,
  SellerRef,
  StaffActor,
} from '../../shared/domain';
import { IMAGE_SLOTS, isImageSlot } from '../../shared/imageSlots';
import {
  parseCreateDishRequest,
  parseCreateDishSetRequest,
  parseCreateMenuRequest,
  parseUpdateDishRequest,
  parseUpdateMenuRequest,
  parseUpdatePickupPlaceRequest,
  parseUpdatePreferencesRequest,
  type DeleteDishResponse,
  type DeletePickupPlaceResponse,
  type DishesResponse,
  type DishResponse,
  type DishSetResponse,
  type DishSetsResponse,
  type FinishMenuResponse,
  type MenuViewResponse,
  type PickupPlaceResponse,
  type PickupPlacesResponse,
  type PreferencesResponse,
  type UpdateMenuResponse,
  type UseDishSetResponse,
} from '../../shared/menusContract';
import type { PastWeekResponse, PastWeeksResponse } from '../../shared/pastWeeks';
import {
  parseChefNameRequest,
  parseImageStyleRequest,
  parseKitchenNameRequest,
  parsePickupPointInput,
  parseUpdateItemRequest,
  parseUploadImageRequest,
  type ChefResponse,
  type ChefsResponse,
  type ImagesResponse,
  type ItemResponse,
  type KitchenNameResponse,
  type OkResponse,
  type RestoreResponse,
} from '../../shared/setupContract';
import { TOKENS_MAX } from '../../shared/limits';
import {
  parsePushSubscribeRequest,
  parsePushUnsubscribeRequest,
  type PublicKeyResponse,
} from '../../shared/pushContract';
import {
  parseCreateOrderRequest,
  parseCreateSellerOrderRequest,
  parseFindOrderRequest,
  parseUpdateOrderRequest,
  toArchivedOrder,
  toCustomerOrder,
  toExpiredOrder,
  type CustomerOrderResponse,
  type CustomerOrdersResponse,
  type ExpiredOrder,
  type FetchedOrderResponse,
  type FindOrderResponse,
  type SellerOrderResponse,
  type SellerOrdersResponse,
} from '../../shared/orderContract';
import { parseOrderCode } from '../../shared/orderCode';
import { DEFAULT_SELLER_SLUG } from '../../shared/seller';
import {
  parseForce,
  parseSetLockedRequest,
  parseSetPaidRequest,
  parseSetStatusRequest,
  parseSetWaReceivedRequest,
  parseSettingsRequest,
  type SettingsResponse,
} from '../../shared/sellerContract';
import {
  ORDER_LOOKUP_MAX_FAILS,
  ORDER_LOOKUP_MAX_FAILS_PER_CLIENT,
  parseChefInviteRequest,
  type KeyResponse,
} from '../../shared/authContract';
import {
  parseSendUpdatesRequest,
  type SendUpdatesResponse,
  type UpdateResult,
} from '../../shared/updateContract';
import { LIVE_PATH, type LiveEventType } from '../../shared/liveContract';
import { deleteImageRefs, putUploadedImage, type ImageBucket } from '../images/r2';
import type { LiveNotifier } from '../live/hub';
import { chefAccess, handleAdmin, handleAuth } from './authRoutes';
import { sessionTokenOf } from '../auth/cookie';
import { sha256Hex } from '../db/crypto';
import { authError, error, readJson } from './respond';
import type { Repository, SellerRepository, StoreResult } from '../repo/Repository';

const DEMO_SAMPLE_COUNT = 50;
const noSeller = () => error('seller_not_found', 'Seller not found');
const weekClosed = () => error('week_closed', 'This week is closed');

/** Header `X-Actor: seller:Bu Ani` or `chef:Wati`. */
const DEFAULT_ACTOR: StaffActor = { role: 'seller', name: 'Bu Ani' };

/** DEV_TOOLS only: the audit name comes from the X-Actor header when there is no session. */
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
 * DEV_TOOLS only: which seller a request without a session is for, from the `X-Seller` slug
 * header (the dev seller picker). A session always decides the seller, never a header.
 */
function sellerSlugOf(request: Request): string {
  const raw = request.headers.get('X-Seller')?.trim();
  return raw ? raw : DEFAULT_SELLER_SLUG;
}

/**
 * A failed store call as an error response. A refusal the seller may override (D-062) carries its
 * `warning`; the same call with `force: true` goes ahead.
 */
function refusal(result: {
  error: ApiErrorCode;
  message: string;
  warning?: ApiWarning | undefined;
}): Response {
  return error(result.error, result.message, result.warning ? { warning: result.warning } : {});
}

/** Seller endpoints return the full order. */
function sellerResult(result: StoreResult<SellerOrder>, status = 200): Response {
  if (!result.ok) return refusal(result);
  const body: SellerOrderResponse = { order: result.value };
  return Response.json(body, { status });
}

function safeParse(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

function itemResult(result: StoreResult<SellerMenuItemView>, status = 200): Response {
  return result.ok
    ? Response.json({ item: result.value } satisfies ItemResponse, { status })
    : error(result.error, result.message);
}

function chefResult(result: StoreResult<Chef>, status = 200): Response {
  return result.ok
    ? Response.json({ chef: result.value } satisfies ChefResponse, { status })
    : error(result.error, result.message);
}

function okResult(result: StoreResult<true>): Response {
  return result.ok
    ? Response.json({ ok: true } satisfies OkResponse)
    : error(result.error, result.message);
}

/** Customer endpoints return the narrowed view (with the seller), never the seller-only fields. */
function customerResult(
  result: StoreResult<SellerOrder>,
  seller: SellerRef,
  status = 200,
): Response {
  if (!result.ok) return refusal(result);
  const body: CustomerOrderResponse = { order: toCustomerOrder(result.value, seller) };
  return Response.json(body, { status });
}

/** What the hosting Worker offers the routes. Both are optional: unit tests run without them. */
export type RouteContext = {
  /** The seller's live room (Durable Object, stage 8.3). */
  live?: LiveNotifier;
  /** Seller images in R2 (stage 8.3). Without it a seller's image stays a data URL in the store. */
  images?: ImageBucket;
  /**
   * Dev tools (the Worker var DEV_TOOLS === "1", set only in .dev.vars). Off or absent is how
   * production runs: the X-Seller / X-Actor override, the live-socket slug fallback and every
   * /api/dev/* route then answer as if they did not exist.
   */
  devTools?: boolean;
  /** The VAPID public key (env `VAPID_PUBLIC_KEY`); absent means web push is not set up. */
  vapidPublicKey?: string | undefined;
};

/**
 * Tells a seller's live room that something changed, after the write has succeeded. Never throws
 * and never delays the answer for long: a missed nudge is covered by the screens' fallback polling.
 */
async function signal(
  context: RouteContext,
  sellerId: string,
  type: LiveEventType,
  code?: string,
): Promise<void> {
  if (!context.live) return;
  try {
    await context.live.notify(sellerId, code === undefined ? { type } : { type, code });
  } catch {
    // see above
  }
}

/** Signals after a customer or seller order write that succeeded; passes the result through. */
async function afterOrderWrite(
  context: RouteContext,
  sellerId: string,
  type: 'order.created' | 'order.changed',
  result: StoreResult<SellerOrder>,
): Promise<StoreResult<SellerOrder>> {
  if (result.ok) await signal(context, sellerId, type, result.value.code);
  return result;
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
  const bad = () => error('invalid_request', 'Invalid request');

  // Public, per seller (D-037). The old unscoped GET /api/menu and POST /api/orders are gone:
  // they fall through (404).
  if (area === 's' && a) {
    const sellerStore = await store.sellerBySlug(a);
    if (!sellerStore) return noSeller();
    if (b === 'menu' && !c && method === 'GET') return Response.json(await sellerStore.getMenu());
    if (b === 'orders' && !c && method === 'POST') {
      const input = parseCreateOrderRequest(await readJson(request));
      if (!input) return bad();
      const result = await afterOrderWrite(
        context,
        sellerStore.seller.id,
        'order.created',
        await sellerStore.createOrder(input),
      );
      return customerResult(result, sellerStore.seller, 201);
    }
    // D-075: a lost order back by code and first name, in this kitchen. Two wrong tries lock it for
    // 15 minutes per kitchen-and-code; ten lock a client address. Every miss answers alike.
    if (b === 'orders' && c === 'find' && method === 'POST') {
      const input = parseFindOrderRequest(await readJson(request));
      if (!input) return bad();
      // Only a hash of the address is kept: wrong-try rows (and so the hash) are swept by the hourly
      // cron once they are older than the lock time and not locked.
      const client = await sha256Hex(request.headers.get('CF-Connecting-IP') ?? 'local');
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

  // Customer endpoints by private token are global: the order knows its seller.
  if (area === 'orders') {
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
          return customerResult({ ok: true, value: hit.order }, hit.sellerRepo.seller);
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
        const result = await afterOrderWrite(
          context,
          hit.sellerRepo.seller.id,
          'order.changed',
          await hit.sellerRepo.updateOrder(a, patch),
        );
        return customerResult(result, hit.sellerRepo.seller);
      }
    }
    // plan 001 stage 4: "I've collected it". The token is the auth, as on the order page. Idempotent.
    if (a && b === 'collected' && !c && method === 'POST') {
      const hit = await store.lookupByToken(a);
      if (!hit) return error('not_found', 'Order not found');
      if (hit.kind !== 'live') return weekClosed();
      const result = await afterOrderWrite(
        context,
        hit.sellerRepo.seller.id,
        'order.changed',
        await hit.sellerRepo.customerCollected(a),
      );
      return customerResult(result, hit.sellerRepo.seller);
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
      const result = await afterOrderWrite(
        context,
        hit.sellerRepo.seller.id,
        'order.changed',
        await hit.sellerRepo.cancelOrder(a),
      );
      return customerResult(result, hit.sellerRepo.seller);
    }
    return null;
  }

  // The VAPID public key a browser needs to subscribe. 404 when push is not set up on this server.
  if (area === 'push' && a === 'public-key' && !b && method === 'GET') {
    return context.vapidPublicKey
      ? Response.json({ publicKey: context.vapidPublicKey } satisfies PublicKeyResponse)
      : error('not_found', 'Notifications are not set up');
  }

  if (area === 'auth') return handleAuth(store, request, [a, b]);
  if (area === 'admin')
    return handleAdmin(
      store,
      request,
      [a, b, c, segments[5], segments[6]],
      context.devTools === true,
    );

  if (pathname === LIVE_PATH) {
    if (method !== 'GET') return null;
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    if (!context.live) return error('not_found', 'Live updates are not available here');
    const who = await liveSeller(store, request, searchParams, context.devTools === true);
    if (who instanceof Response) return who;
    return context.live.connect(who.sellerId);
  }

  if (area === 'seller') {
    const caller = await store.auth.resolve(sessionTokenOf(request));
    // A session wins over everything else: the seller (and the audit name) come from it, and a
    // different X-Seller / X-Actor header is ignored, so seller A can never act as seller B.
    if (sessionTokenOf(request) !== undefined) {
      if (!caller || caller.setup) return error('unauthorized', 'Sign in first');
      if (caller.role === 'admin') return error('forbidden', 'Admins have no order data');
      const sellerStore = caller.sellerId ? await store.sellerById(caller.sellerId) : undefined;
      if (!sellerStore) return error('unauthorized', 'Sign in first');
      const chefName =
        caller.role === 'chef' && caller.chefId
          ? (await sellerStore.listChefs()).find((chef) => chef.id === caller.chefId)?.name
          : undefined;
      if (caller.role === 'chef' && !chefName) return error('unauthorized', 'Sign in first');
      const actor: StaffActor =
        caller.role === 'chef'
          ? { role: 'chef', name: chefName as string }
          : { role: 'seller', name: sellerStore.seller.name };
      if (caller.role === 'chef' && chefMayNot(request.method, a)) {
        return error('forbidden', 'Chefs cannot do this');
      }
      // Plan 013: sample orders on a demo kitchen. A session of this kitchen (seller or chef) is
      // needed (we are past that check) and the kitchen must be a demo one; the origin check is at
      // the door (handleWorkerRequest). Nothing here depends on DEV_TOOLS.
      if (a === 'demo' && b === 'samples' && !c) {
        if (method !== 'POST' && method !== 'DELETE') return null;
        if (sellerStore.seller.demo !== true) return error('forbidden', 'Not a demo kitchen');
        if (method === 'DELETE') {
          return Response.json(
            (await sellerStore.clearDemoSamples()) satisfies ClearSamplesResponse,
          );
        }
        const result = await sellerStore.addDemoSamples(DEMO_SAMPLE_COUNT);
        if (result.added > 0) await signal(context, sellerStore.seller.id, 'order.created');
        return Response.json(result satisfies SampleOrdersResponse);
      }
      return handleSeller(store, sellerStore, request, [a, b, c], bad, actor, context);
    }
    // DEV_TOOLS only: without a session the X-Seller / X-Actor headers choose the seller and the
    // audit name, with full seller rights (no chef limits). Production answers 401.
    if (context.devTools !== true) return error('unauthorized', 'Sign in first');
    const sellerStore = await store.sellerBySlug(sellerSlugOf(request));
    if (!sellerStore) return noSeller();
    return handleSeller(store, sellerStore, request, [a, b, c], bad, actorOf(request), context);
  }

  if (area === 'dev' && context.devTools === true) {
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
  }
  return null;
}

/**
 * What a chef may not do (D-013): the chef gets everything the seller has except changes to the
 * menu (items, order, saved sets), the chefs list, images, week settings (incl. publish and
 * close), settings, backup and restore, and invites. Reading those is allowed (the order screens
 * need the menu, chefs and settings); backup is closed in both directions.
 */
function chefMayNot(method: string, a: string | undefined): boolean {
  if (a === 'backup' || a === 'chef-invites' || a === 'chef-devices') return true;
  const closed = [
    'menu',
    'chefs',
    'sets',
    'images',
    'week',
    'settings',
    // plan 001, stage 3
    'menus',
    'dishes',
    'saved-sets',
    'pickup-places',
    'preferences',
    'kitchen',
  ];
  return closed.includes(a ?? '') && method !== 'GET';
}

/**
 * Deletes the R2 objects behind these refs unless something still shows them: the kitchen's
 * slots, or a saved set (sets keep their own copy of the refs, and "use set" copies them back).
 */
async function dropUnusedImages(
  bucket: ImageBucket,
  store: SellerRepository,
  refs: ReadonlyArray<string | undefined>,
  sellerId: string,
): Promise<void> {
  const backup = await store.exportBackup();
  const inUse = new Set<string>();
  for (const images of [backup.kitchen.images, ...backup.sets.map((set) => set.images)]) {
    for (const slot of IMAGE_SLOTS) {
      const ref = images?.[slot];
      if (ref !== undefined) inUse.add(ref);
    }
  }
  if (backup.menu?.pictureRef !== undefined) inUse.add(backup.menu.pictureRef);
  await deleteImageRefs(
    bucket,
    refs.filter((ref) => ref !== undefined && !inUse.has(ref)),
    sellerId,
  );
}

/** Everything under /api/seller/*, for the one seller the request is scoped to. */
async function handleSeller(
  repo: Repository,
  store: SellerRepository,
  request: Request,
  [a, b, c]: [string | undefined, string | undefined, string | undefined],
  bad: () => Response,
  actor: StaffActor,
  context: RouteContext,
): Promise<Response | null> {
  const method = request.method;
  const sellerId = store.seller.id;
  const changed = (result: StoreResult<SellerOrder>) =>
    afterOrderWrite(context, sellerId, 'order.changed', result);
  const menuChanged = () => signal(context, sellerId, 'menu.changed');
  if (a === 'menu' && !b && method === 'GET') return Response.json(await store.getSellerMenu());

  // Chefs can't invite people (D-013); the seller invites a chef from the chefs list.
  if (a === 'chef-invites' && !b && method === 'POST') {
    const input = parseChefInviteRequest(await readJson(request));
    if (!input) return bad();
    if (!(await store.listChefs()).some((chef) => chef.id === input.chefId)) {
      return error('unknown_chef', 'Unknown chef');
    }
    const key = await repo.auth.createKey(
      { role: 'chef', sellerId: store.seller.id, chefId: input.chefId },
      'invite',
    );
    return Response.json(key satisfies KeyResponse, { status: 201 });
  }

  // How many devices each chef has signed in (the chefs screen shows it next to the invite).
  if (a === 'chef-devices' && !b && method === 'GET') {
    return Response.json(await chefAccess(repo, store));
  }

  // plan 001 stage 4: messages. The log of the current menu, and a message to a pickup place.
  if (a === 'messages') {
    if (!b && method === 'GET') {
      return Response.json({ messages: await store.listMessages() } satisfies MessagesResponse);
    }
    if (b === 'place' && c && method === 'POST') {
      const input = parseMessagePlaceRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.messagePlace(c, input, actor);
      if (!result.ok) return refusal(result);
      // Many orders changed (and `ready_now` moved some to Ready): the screens refetch.
      await signal(context, sellerId, 'order.changed');
      return Response.json(result.value satisfies MessagePlaceResponse);
    }
    return null;
  }

  // Bulk updates to customers' inboxes (Saturday tools).
  if (a === 'updates' && !b && method === 'POST') {
    const input = parseSendUpdatesRequest(await readJson(request));
    if (!input) return bad();
    const { codes, ...update } = input;
    // Forgiving codes ("k7f-2qx") are normalised first, so the same order is not sent twice.
    const unique = [...new Set(codes.map((code) => parseOrderCode(code) ?? code))];
    const results: Array<UpdateResult> = await store.sendUpdates(unique, update, actor);
    for (const entry of results)
      if (entry.ok) await signal(context, sellerId, 'order.changed', entry.code);
    return Response.json({
      results,
      sent: results.filter((entry) => entry.ok).length,
    } satisfies SendUpdatesResponse);
  }

  if (a === 'settings' && !b) {
    const sellerId = store.seller.id;
    if (method === 'GET') {
      const settings = await store.getSettings();
      return Response.json({ sellerId, settings } satisfies SettingsResponse);
    }
    if (method === 'PUT') {
      const input = parseSettingsRequest(await readJson(request));
      return input
        ? Response.json({
            sellerId,
            settings: await store.setSettings(input),
          } satisfies SettingsResponse)
        : bad();
    }
    return null;
  }

  if (a === 'past-weeks') {
    if (!b && method === 'GET') {
      return Response.json({ weeks: await store.listPastWeeks() } satisfies PastWeeksResponse);
    }
    if (b && !c && method === 'GET') {
      const week = await store.getPastWeek(b);
      return week
        ? Response.json({ week } satisfies PastWeekResponse)
        : error('not_found', 'Week not found');
    }
    return null;
  }

  // The legacy item edit (PATCH /menu/items/:id, used by the live Dishes panel).
  if (a === 'menu' && b === 'items' && c && method === 'PATCH') {
    const input = parseUpdateItemRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.patchItem(c, input);
    if (result.ok) await menuChanged();
    return itemResult(result);
  }

  // ---- Menus and dishes (plan 001, stage 3) ----

  // The one menu: not published -> live -> finished (D-063). A new one only after it finished.
  if (a === 'menus') {
    if (!b && method === 'POST') {
      const text = await request.text();
      const input = parseCreateMenuRequest(text === '' ? undefined : safeParse(text));
      if (!input) return bad();
      const result = await store.createMenu(input);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({ menu: result.value } satisfies MenuViewResponse, { status: 201 });
    }
    if (b !== 'current') return null;
    if (!c && method === 'GET') {
      return Response.json({ menu: await store.getCurrentMenu() } satisfies MenuViewResponse);
    }
    if (!c && method === 'PUT') {
      const input = parseUpdateMenuRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.updateMenu(input);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json(result.value satisfies UpdateMenuResponse);
    }
    if (c === 'publish' && method === 'POST') {
      const force = parseForce(await readJson(request));
      if (force === null) return bad();
      const result = await store.publishMenu(force);
      if (!result.ok) return refusal(result);
      await menuChanged();
      return Response.json({ menu: result.value } satisfies MenuViewResponse);
    }
    if (!c && method === 'DELETE') {
      const result = await store.deleteMenu();
      if (!result.ok) return error(result.error, result.message);
      if (context.images) {
        await dropUnusedImages(context.images, store, [result.value.before], sellerId);
      }
      await menuChanged();
      return Response.json({ menu: result.value.view } satisfies MenuViewResponse);
    }
    if (c === 'unpublish' && method === 'POST') {
      const result = await store.unpublishMenu();
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({ menu: result.value } satisfies MenuViewResponse);
    }
    // The menu picture (D-060): R2 with a bucket, the same pattern as the kitchen images.
    if (c === 'picture' && method === 'PUT') {
      const input = parseUploadImageRequest(await readJson(request));
      if (!input) return bad();
      const stored = context.images
        ? await putUploadedImage(context.images, sellerId, 'menuPicture', input.dataUrl)
        : null;
      const result = await store.setMenuPicture(input.dataUrl, stored?.ref);
      if (!result.ok) {
        if (stored && context.images) {
          await dropUnusedImages(context.images, store, [stored.ref], sellerId);
        }
        return error(result.error, result.message);
      }
      if (context.images) {
        await dropUnusedImages(context.images, store, [result.value.before], sellerId);
      }
      await menuChanged();
      return Response.json({ menu: result.value.view } satisfies MenuViewResponse);
    }
    if (c === 'picture' && method === 'DELETE') {
      const removed = await store.removeMenuPicture();
      if (context.images) await dropUnusedImages(context.images, store, [removed.before], sellerId);
      await menuChanged();
      return Response.json({ menu: removed.view } satisfies MenuViewResponse);
    }
    if (c === 'finish' && method === 'POST') {
      const result = await store.finishMenuNow();
      if (!result.ok) return error(result.error, result.message);
      // The open orders were closed and archived: the order screens refetch too.
      await signal(context, sellerId, 'order.changed');
      await menuChanged();
      return Response.json(result.value satisfies FinishMenuResponse);
    }
    return null;
  }

  // "Your dishes". Deleting one is always allowed; `usedOnLiveMenu` is the warning (D-062).
  if (a === 'dishes') {
    if (!b && method === 'GET') {
      return Response.json({ dishes: await store.listDishes() } satisfies DishesResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateDishRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.createDish(input);
      if (!result.ok) return error(result.error, result.message);
      return Response.json({ dish: result.value } satisfies DishResponse, { status: 201 });
    }
    if (b && !c && method === 'PATCH') {
      const input = parseUpdateDishRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.updateDish(b, input);
      if (!result.ok) return error(result.error, result.message);
      return Response.json({ dish: result.value } satisfies DishResponse);
    }
    if (b && !c && method === 'DELETE') {
      const result = await store.deleteDish(b);
      if (!result.ok) return error(result.error, result.message);
      if (result.value.usedOnLiveMenu) await menuChanged();
      return Response.json({
        ok: true,
        usedOnLiveMenu: result.value.usedOnLiveMenu,
      } satisfies DeleteDishResponse);
    }
    return null;
  }

  // Saved sets as lists of dishes. (The older /sets endpoints above keep their item-copy shape.)
  if (a === 'saved-sets') {
    if (!b && method === 'GET') {
      return Response.json({ sets: await store.listDishSets() } satisfies DishSetsResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateDishSetRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.createDishSet(input);
      if (!result.ok) return error(result.error, result.message);
      return Response.json({ set: result.value } satisfies DishSetResponse, { status: 201 });
    }
    if (b && c === 'use' && method === 'POST') {
      const result = await store.useDishSet(b);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json(result.value satisfies UseDishSetResponse);
    }
    return null;
  }

  // Saved pickup places: at most 5 (`pickup_place_limit`).
  if (a === 'pickup-places') {
    if (!b && method === 'GET') {
      return Response.json({
        places: await store.listPickupPlaces(),
      } satisfies PickupPlacesResponse);
    }
    if (!b && method === 'POST') {
      const input = parsePickupPointInput(await readJson(request));
      if (!input) return bad();
      const result = await store.createPickupPlace(input);
      if (!result.ok) return error(result.error, result.message);
      return Response.json({ place: result.value } satisfies PickupPlaceResponse, { status: 201 });
    }
    if (b && !c && method === 'PATCH') {
      const input = parseUpdatePickupPlaceRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.updatePickupPlace(b, input);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({ place: result.value } satisfies PickupPlaceResponse);
    }
    if (b && !c && method === 'DELETE') {
      const result = await store.deletePickupPlace(b);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({
        ok: true,
        usedOnLiveMenu: result.value.usedOnLiveMenu,
      } satisfies DeletePickupPlaceResponse);
    }
    return null;
  }

  // The kitchen's colour theme (D-064) and the defaults a new menu starts from.
  if (a === 'preferences' && !b) {
    if (method === 'GET') {
      return Response.json({
        preferences: await store.getPreferences(),
      } satisfies PreferencesResponse);
    }
    if (method === 'PUT') {
      const input = parseUpdatePreferencesRequest(await readJson(request));
      if (!input) return bad();
      return Response.json({
        preferences: await store.setPreferences(input),
      } satisfies PreferencesResponse);
    }
    return null;
  }

  // The owner renames the kitchen (chefs are closed out by chefMayNot).
  if (a === 'kitchen' && b === 'name' && !c) {
    if (method !== 'PUT') return null;
    const input = parseKitchenNameRequest(await readJson(request));
    if (!input) return bad();
    return Response.json({
      name: await store.setKitchenName(input.name),
    } satisfies KitchenNameResponse);
  }

  if (a === 'chefs') {
    if (!b && method === 'GET') {
      return Response.json({ chefs: await store.listChefs() } satisfies ChefsResponse);
    }
    if (!b && method === 'POST') {
      const input = parseChefNameRequest(await readJson(request));
      return input ? chefResult(await store.addChef(input.name), 201) : bad();
    }
    if (b && method === 'PATCH') {
      const input = parseChefNameRequest(await readJson(request));
      return input ? chefResult(await store.renameChef(b, input.name)) : bad();
    }
    if (b && method === 'DELETE') {
      const removed = await store.removeChef(b);
      if (removed.ok) await repo.auth.revokeChef(store.seller.id, b);
      return okResult(removed);
    }
    return null;
  }

  if (a === 'images') {
    if (!b && method === 'GET') {
      return Response.json({ images: await store.getImages() } satisfies ImagesResponse);
    }
    if (!b && method === 'PUT') {
      const input = parseImageStyleRequest(await readJson(request));
      return input
        ? Response.json({ images: await store.setImageStyle(input) } satisfies ImagesResponse)
        : bad();
    }
    if (b && !c) {
      if (!isImageSlot(b)) return error('not_found', 'Unknown image place');
      if (method === 'PUT') {
        const input = parseUploadImageRequest(await readJson(request));
        if (!input) return bad();
        const before = await store.getImages();
        // With a bucket the bytes go to R2 and the store keeps the path; an invalid upload is not
        // stored there, and the store answers it with the usual error.
        const stored = context.images
          ? await putUploadedImage(context.images, sellerId, b, input.dataUrl)
          : null;
        const result = await store.setImage(b, input.dataUrl, stored?.ref);
        if (!result.ok) {
          if (stored && context.images) {
            await dropUnusedImages(context.images, store, [stored.ref], sellerId);
          }
          return error(result.error, result.message);
        }
        if (context.images) await dropUnusedImages(context.images, store, [before[b]], sellerId);
        return Response.json({ images: result.value } satisfies ImagesResponse);
      }
      if (method === 'DELETE') {
        const before = await store.getImages();
        const images = await store.removeImage(b);
        if (context.images) await dropUnusedImages(context.images, store, [before[b]], sellerId);
        return Response.json({ images } satisfies ImagesResponse);
      }
    }
    return null;
  }

  if (a === 'backup' && !b) {
    if (method === 'GET') return Response.json(await store.exportBackup());
    if (method === 'POST') {
      const file = parseBackupFile(await readJson(request));
      if (!file) return error('invalid_backup', 'This is not a valid backup file');
      const owners = await repo.liveOrderOwners(file.orders.map((order) => order.token));
      if ([...owners.values()].some((owner) => owner !== store.seller.id)) {
        return error('invalid_backup', 'An order in this backup belongs to another kitchen');
      }
      const droppedImages = await store.restoreBackup(file);
      await signal(context, sellerId, 'order.changed');
      await menuChanged();
      return Response.json({ ok: true, droppedImages } satisfies RestoreResponse);
    }
    return null;
  }

  if (a === 'orders.csv' && !b && method === 'GET') {
    return new Response(await store.ordersCsv(), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${store.seller.slug}.csv"`,
      },
    });
  }

  if (a === 'orders') {
    if (!b && method === 'GET') {
      return Response.json({ orders: await store.listOrders() } satisfies SellerOrdersResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateSellerOrderRequest(await readJson(request));
      if (!input) return bad();
      const result = await afterOrderWrite(
        context,
        sellerId,
        'order.created',
        await store.createSellerOrder(input, actor),
      );
      return sellerResult(result, 201);
    }
    const code = b ? parseOrderCode(b) : null;
    if (b && !c && method === 'GET') {
      const order = code ? await store.getByCode(code) : undefined;
      return order
        ? Response.json({ order } satisfies SellerOrderResponse)
        : error('not_found', 'Order not found');
    }
    if (b && c === 'status' && method === 'POST') {
      const input = parseSetStatusRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(
            await changed(await store.setStatus(code, input.to, actor, input.force === true)),
          )
        : error('not_found', 'Order not found');
    }
    if (b && c === 'pack' && method === 'POST') {
      const input = parsePackRequest(await readJson(request));
      if (!input) return bad();
      // The signal carries only the code, for the seller's other screens; a customer's view of the
      // order does not change (D-066).
      const result = code ? await store.packOrder(code, input) : null;
      if (!result) return error('not_found', 'Order not found');
      if (result.ok) await signal(context, sellerId, 'order.changed', result.value.code);
      return sellerResult(result);
    }
    if (b && c === 'delivery-step' && method === 'POST') {
      const input = parseDeliveryStepRequest(await readJson(request));
      if (!input) return bad();
      if (!code) return error('not_found', 'Order not found');
      const result = await store.deliveryStep(code, input, actor);
      if (!result.ok) return refusal(result);
      await signal(context, sellerId, 'order.changed', code);
      return Response.json(result.value satisfies DeliveryStepResponse);
    }
    if (b && c === 'collected' && method === 'POST') {
      const input = parseMarkCollectedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(await changed(await store.markCollected(code, input, actor)))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'paid' && method === 'POST') {
      const input = parseSetPaidRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(await changed(await store.setPaid(code, input.paid, actor)))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'lock' && method === 'POST') {
      const input = parseSetLockedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(await changed(await store.setLocked(code, input.locked)))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'wa-received' && method === 'POST') {
      const input = parseSetWaReceivedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(await changed(await store.setWaReceived(code, input.received)))
        : error('not_found', 'Order not found');
    }
    if (b && (c === 'nudge' || c === 'seen') && method === 'POST') {
      if (!code) return error('not_found', 'Order not found');
      const force = c === 'nudge' ? parseForce(await readJson(request)) : false;
      if (force === null) return bad();
      return sellerResult(
        await changed(c === 'nudge' ? await store.nudge(code, force) : await store.markSeen(code)),
      );
    }
  }
  return null;
}
