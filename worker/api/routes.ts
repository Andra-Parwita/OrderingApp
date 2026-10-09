// API routes on standard Request/Response; shared by the Worker and the MSW handlers.
import { parseSampleOrdersRequest, type DevSellersResponse } from '../../shared/devContract';
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
import type { PastWeekResponse, PastWeeksResponse } from '../../shared/pastWeeks';
import {
  parseChefNameRequest,
  parseCreateItemRequest,
  parseImageStyleRequest,
  parseRenameSetRequest,
  parseReorderItemsRequest,
  parseSaveSetRequest,
  parseUpdateItemRequest,
  parseUploadImageRequest,
  parseUseSetRequest,
  parseWeekSettingsRequest,
  type ChefResponse,
  type ChefsResponse,
  type CloseWeekResponse,
  type ImagesResponse,
  type ItemResponse,
  type ItemsResponse,
  type OkResponse,
  type SavedSetView,
  type SetResponse,
  type SetsResponse,
  type WeekResponse,
} from '../../shared/setupContract';
import { TOKENS_MAX } from '../../shared/limits';
import {
  parseCreateOrderRequest,
  parseCreateSellerOrderRequest,
  parseUpdateOrderRequest,
  toArchivedOrder,
  toCustomerOrder,
  toExpiredOrder,
  type CustomerOrderResponse,
  type CustomerOrdersResponse,
  type ExpiredOrder,
  type FetchedOrderResponse,
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
import { parseChefInviteRequest, type KeyResponse } from '../../shared/authContract';
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
import { error, readJson } from './respond';
import type { Repository, SellerRepository, StoreResult } from '../repo/Repository';

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

/** Seller endpoints return the full order. */
function sellerResult(result: StoreResult<SellerOrder>, status = 200): Response {
  if (!result.ok) return error(result.error, result.message);
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

function setResult(result: StoreResult<SavedSetView>, status = 200): Response {
  return result.ok
    ? Response.json({ set: result.value } satisfies SetResponse, { status })
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
  if (!result.ok) return error(result.error, result.message);
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
      const added = await store.dev.addSampleOrders(sellerStore.seller.id, input.count);
      if (added > 0) await signal(context, sellerStore.seller.id, 'order.created');
      return Response.json({ added });
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
  const closed = ['menu', 'chefs', 'sets', 'images', 'week', 'settings'];
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
): Promise<void> {
  const backup = await store.exportBackup();
  const inUse = new Set<string>();
  for (const images of [backup.kitchen.images, ...backup.sets.map((set) => set.images)]) {
    for (const slot of IMAGE_SLOTS) {
      const ref = images?.[slot];
      if (ref !== undefined) inUse.add(ref);
    }
  }
  await deleteImageRefs(
    bucket,
    refs.filter((ref) => ref !== undefined && !inUse.has(ref)),
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

  if (a === 'week') {
    if (!b && method === 'GET')
      return Response.json({ week: await store.getWeek() } satisfies WeekResponse);
    if (!b && method === 'PUT') {
      const input = parseWeekSettingsRequest(await readJson(request));
      if (!input) return bad();
      const week = await store.updateWeek(input);
      await menuChanged();
      return Response.json({ week } satisfies WeekResponse);
    }
    if (b === 'publish' && !c && method === 'POST') {
      const result = await store.publishWeek();
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({ week: result.value } satisfies WeekResponse);
    }
    if (b === 'unpublish' && !c && method === 'POST') {
      const week = await store.unpublishWeek();
      await menuChanged();
      return Response.json({ week } satisfies WeekResponse);
    }
    if (b === 'close' && !c && method === 'POST') {
      const closed = await store.closeWeek();
      // The live orders were archived and a new draft week began: both screens refetch.
      await signal(context, sellerId, 'order.changed');
      await menuChanged();
      return Response.json(closed satisfies CloseWeekResponse);
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

  if (a === 'menu' && b === 'items') {
    if (!c && method === 'POST') {
      const input = parseCreateItemRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.addItem(input);
      if (result.ok) await menuChanged();
      return itemResult(result, 201);
    }
    if (c && method === 'PATCH') {
      const input = parseUpdateItemRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.patchItem(c, input);
      if (result.ok) await menuChanged();
      return itemResult(result);
    }
    if (c && method === 'DELETE') {
      const result = await store.removeItem(c);
      if (result.ok) await menuChanged();
      return okResult(result);
    }
    return null;
  }
  if (a === 'menu' && b === 'order' && !c && method === 'PUT') {
    const input = parseReorderItemsRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.reorderItems(input.ids);
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json({ items: result.value } satisfies ItemsResponse);
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

  if (a === 'sets') {
    if (!b && method === 'GET') {
      return Response.json({ sets: await store.listSets() } satisfies SetsResponse);
    }
    if (!b && method === 'POST') {
      const input = parseSaveSetRequest(await readJson(request));
      return input ? setResult(await store.saveSet(input.name, input.replaceSetId), 201) : bad();
    }
    if (b && !c && method === 'PATCH') {
      const input = parseRenameSetRequest(await readJson(request));
      return input ? setResult(await store.renameSet(b, input.name)) : bad();
    }
    if (b && !c && method === 'DELETE') return okResult(await store.removeSet(b));
    if (b && c === 'use' && method === 'POST') {
      const text = await request.text();
      const input = parseUseSetRequest(text === '' ? undefined : safeParse(text));
      if (!input) return bad();
      const result = await store.useSet(b, input);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({ items: result.value } satisfies ItemsResponse);
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
          if (stored && context.images) await dropUnusedImages(context.images, store, [stored.ref]);
          return error(result.error, result.message);
        }
        if (context.images) await dropUnusedImages(context.images, store, [before[b]]);
        return Response.json({ images: result.value } satisfies ImagesResponse);
      }
      if (method === 'DELETE') {
        const before = await store.getImages();
        const images = await store.removeImage(b);
        if (context.images) await dropUnusedImages(context.images, store, [before[b]]);
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
      await store.restoreBackup(file);
      await signal(context, sellerId, 'order.changed');
      await menuChanged();
      return Response.json({ ok: true } satisfies OkResponse);
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
        ? sellerResult(await changed(await store.setStatus(code, input.to, actor)))
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
    if (b && c === 'arriving-soon' && method === 'POST') {
      return code
        ? sellerResult(await changed(await store.arrivingSoon(code)))
        : error('not_found', 'Order not found');
    }
    if (b && (c === 'nudge' || c === 'seen') && method === 'POST') {
      if (!code) return error('not_found', 'Order not found');
      return sellerResult(
        await changed(c === 'nudge' ? await store.nudge(code) : await store.markSeen(code)),
      );
    }
  }
  return null;
}
