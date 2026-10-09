// Mock API routes on standard Request/Response; shared by the dev Worker and the MSW handlers.
import { parseSampleOrdersRequest, type DevSellersResponse } from '../../shared/devContract';
import type { ApiErrorBody, ApiErrorCode } from '../../shared/apiError';
import { parseBackupFile } from '../../shared/backup';
import type {
  Chef,
  CustomerOrder,
  SellerMenuItemView,
  SellerOrder,
  SellerRef,
  StaffActor,
} from '../../shared/domain';
import { isImageSlot } from '../../shared/imageSlots';
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
import type { MockStore, SellerStore, StoreResult } from './store';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unknown_item: 400,
  not_found: 404,
  seller_not_found: 404,
  cutoff_passed: 409,
  week_not_published: 409,
  sold_out: 409,
  exceeds_remaining: 409,
  invalid_status: 409,
  order_locked: 409,
  ordering_closed: 409,
  item_has_orders: 409,
  limit_reached: 409,
  no_items: 409,
  confirm_required: 409,
  week_not_draft: 409,
  week_closed: 409,
  unknown_chef: 400,
  image_type: 400,
  image_too_big: 400,
  image_ratio: 400,
  invalid_backup: 400,
};

function error(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: code, message };
  return Response.json(body, { status: STATUS[code] });
}

const noSeller = () => error('seller_not_found', 'Seller not found');
const weekClosed = () => error('week_closed', 'This week is closed');

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

/**
 * Which seller a seller-side request is for: the `X-Seller` slug header. No auth yet: phase 4
 * replaces this with the signed-in session (the seller then comes from the session, never from a
 * header). Without the header the dev default is used, so the single-seller app keeps working
 * until stage 5.2 adds the dev seller picker.
 */
function sellerSlugOf(request: Request): string {
  const raw = request.headers.get('X-Seller')?.trim();
  return raw ? raw : DEFAULT_SELLER_SLUG;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return undefined;
  }
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

/** Returns null when no mock route matches, so the caller can fall through. */
export async function handleMockRequest(
  store: MockStore,
  request: Request,
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
    const sellerStore = store.seller(a);
    if (!sellerStore) return noSeller();
    if (b === 'menu' && !c && method === 'GET') return Response.json(sellerStore.getMenu());
    if (b === 'orders' && !c && method === 'POST') {
      const input = parseCreateOrderRequest(await readJson(request));
      return input
        ? customerResult(sellerStore.createOrder(input), sellerStore.seller, 201)
        : bad();
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
      for (const token of tokens) {
        const hit = store.lookupByToken(token);
        if (!hit) continue;
        if (hit.kind === 'live') orders.push(toCustomerOrder(hit.order, hit.store.seller));
        else if (hit.kind === 'archived') {
          orders.push(toArchivedOrder(hit.order, hit.store.seller, hit.cookingDate));
        } else expired.push(toExpiredOrder(token, hit.store.seller, hit.cookingDate));
      }
      const body: CustomerOrdersResponse = { orders, ...(expired.length > 0 ? { expired } : {}) };
      return Response.json(body);
    }
    if (a && !b) {
      const hit = store.lookupByToken(a);
      if (method === 'GET') {
        if (!hit) return error('not_found', 'Order not found');
        if (hit.kind === 'live') {
          return customerResult({ ok: true, value: hit.order }, hit.store.seller);
        }
        if (hit.kind === 'archived') {
          const order = toArchivedOrder(hit.order, hit.store.seller, hit.cookingDate);
          return Response.json({ order } satisfies CustomerOrderResponse);
        }
        const expired = toExpiredOrder(a, hit.store.seller, hit.cookingDate);
        return Response.json({ expired } satisfies FetchedOrderResponse);
      }
      if (method === 'PATCH') {
        const patch = parseUpdateOrderRequest(await readJson(request));
        if (!patch) return bad();
        if (!hit) return error('not_found', 'Order not found');
        if (hit.kind !== 'live') return weekClosed();
        return customerResult(hit.store.updateOrder(a, patch), hit.store.seller);
      }
    }
    if (a && b === 'cancel' && !c && method === 'POST') {
      const hit = store.lookupByToken(a);
      if (!hit) return error('not_found', 'Order not found');
      if (hit.kind !== 'live') return weekClosed();
      return customerResult(hit.store.cancelOrder(a), hit.store.seller);
    }
    return null;
  }

  if (area === 'seller') {
    const sellerStore = store.seller(sellerSlugOf(request));
    if (!sellerStore) return noSeller();
    return handleSeller(store, sellerStore, request, [a, b, c], bad);
  }

  if (area === 'dev') {
    if (a === 'sellers' && !b && method === 'GET') {
      return Response.json({ sellers: store.sellers() } satisfies DevSellersResponse);
    }
    if (method === 'POST' && a === 'sample-orders') {
      const sellerStore = store.seller(sellerSlugOf(request));
      if (!sellerStore) return noSeller();
      const input = parseSampleOrdersRequest(await readJson(request));
      return input ? Response.json({ added: sellerStore.addSampleOrders(input.count) }) : bad();
    }
    if (method === 'POST' && a === 'reset') {
      store.reset();
      return Response.json({ ok: true });
    }
  }
  return null;
}

/** Everything under /api/seller/*, for the one seller the request is scoped to. */
async function handleSeller(
  mock: MockStore,
  store: SellerStore,
  request: Request,
  [a, b, c]: [string | undefined, string | undefined, string | undefined],
  bad: () => Response,
): Promise<Response | null> {
  const method = request.method;
  if (a === 'menu' && !b && method === 'GET') return Response.json(store.getSellerMenu());

  if (a === 'settings' && !b) {
    const sellerId = store.seller.id;
    if (method === 'GET') {
      return Response.json({ sellerId, settings: store.getSettings() } satisfies SettingsResponse);
    }
    if (method === 'PUT') {
      const input = parseSettingsRequest(await readJson(request));
      return input
        ? Response.json({ sellerId, settings: store.setSettings(input) } satisfies SettingsResponse)
        : bad();
    }
    return null;
  }

  if (a === 'week') {
    if (!b && method === 'GET')
      return Response.json({ week: store.getWeek() } satisfies WeekResponse);
    if (!b && method === 'PUT') {
      const input = parseWeekSettingsRequest(await readJson(request));
      return input
        ? Response.json({ week: store.updateWeek(input) } satisfies WeekResponse)
        : bad();
    }
    if (b === 'publish' && !c && method === 'POST') {
      const result = store.publishWeek();
      return result.ok
        ? Response.json({ week: result.value } satisfies WeekResponse)
        : error(result.error, result.message);
    }
    if (b === 'unpublish' && !c && method === 'POST') {
      return Response.json({ week: store.unpublishWeek() } satisfies WeekResponse);
    }
    if (b === 'close' && !c && method === 'POST') {
      return Response.json(store.closeWeek() satisfies CloseWeekResponse);
    }
    return null;
  }

  if (a === 'past-weeks') {
    if (!b && method === 'GET') {
      return Response.json({ weeks: store.listPastWeeks() } satisfies PastWeeksResponse);
    }
    if (b && !c && method === 'GET') {
      const week = store.getPastWeek(b);
      return week
        ? Response.json({ week } satisfies PastWeekResponse)
        : error('not_found', 'Week not found');
    }
    return null;
  }

  if (a === 'menu' && b === 'items') {
    if (!c && method === 'POST') {
      const input = parseCreateItemRequest(await readJson(request));
      return input ? itemResult(store.addItem(input), 201) : bad();
    }
    if (c && method === 'PATCH') {
      const input = parseUpdateItemRequest(await readJson(request));
      return input ? itemResult(store.patchItem(c, input)) : bad();
    }
    if (c && method === 'DELETE') return okResult(store.removeItem(c));
    return null;
  }
  if (a === 'menu' && b === 'order' && !c && method === 'PUT') {
    const input = parseReorderItemsRequest(await readJson(request));
    if (!input) return bad();
    const result = store.reorderItems(input.ids);
    return result.ok
      ? Response.json({ items: result.value } satisfies ItemsResponse)
      : error(result.error, result.message);
  }

  if (a === 'chefs') {
    if (!b && method === 'GET') {
      return Response.json({ chefs: store.listChefs() } satisfies ChefsResponse);
    }
    if (!b && method === 'POST') {
      const input = parseChefNameRequest(await readJson(request));
      return input ? chefResult(store.addChef(input.name), 201) : bad();
    }
    if (b && method === 'PATCH') {
      const input = parseChefNameRequest(await readJson(request));
      return input ? chefResult(store.renameChef(b, input.name)) : bad();
    }
    if (b && method === 'DELETE') return okResult(store.removeChef(b));
    return null;
  }

  if (a === 'sets') {
    if (!b && method === 'GET') {
      return Response.json({ sets: store.listSets() } satisfies SetsResponse);
    }
    if (!b && method === 'POST') {
      const input = parseSaveSetRequest(await readJson(request));
      return input ? setResult(store.saveSet(input.name, input.replaceSetId), 201) : bad();
    }
    if (b && !c && method === 'PATCH') {
      const input = parseRenameSetRequest(await readJson(request));
      return input ? setResult(store.renameSet(b, input.name)) : bad();
    }
    if (b && !c && method === 'DELETE') return okResult(store.removeSet(b));
    if (b && c === 'use' && method === 'POST') {
      const text = await request.text();
      const input = parseUseSetRequest(text === '' ? undefined : safeParse(text));
      if (!input) return bad();
      const result = store.useSet(b, input);
      return result.ok
        ? Response.json({ items: result.value } satisfies ItemsResponse)
        : error(result.error, result.message);
    }
    return null;
  }

  if (a === 'images') {
    if (!b && method === 'GET') {
      return Response.json({ images: store.getImages() } satisfies ImagesResponse);
    }
    if (!b && method === 'PUT') {
      const input = parseImageStyleRequest(await readJson(request));
      return input
        ? Response.json({ images: store.setImageStyle(input) } satisfies ImagesResponse)
        : bad();
    }
    if (b && !c) {
      if (!isImageSlot(b)) return error('not_found', 'Unknown image place');
      if (method === 'PUT') {
        const input = parseUploadImageRequest(await readJson(request));
        if (!input) return bad();
        const result = store.setImage(b, input.dataUrl);
        return result.ok
          ? Response.json({ images: result.value } satisfies ImagesResponse)
          : error(result.error, result.message);
      }
      if (method === 'DELETE') {
        return Response.json({ images: store.removeImage(b) } satisfies ImagesResponse);
      }
    }
    return null;
  }

  if (a === 'backup' && !b) {
    if (method === 'GET') return Response.json(store.exportBackup());
    if (method === 'POST') {
      const file = parseBackupFile(await readJson(request));
      if (!file) return error('invalid_backup', 'This is not a valid backup file');
      const taken = file.orders.some((order) => {
        const hit = mock.findByToken(order.token);
        return hit !== undefined && hit.store.seller.id !== store.seller.id;
      });
      if (taken) {
        return error('invalid_backup', 'An order in this backup belongs to another kitchen');
      }
      store.restoreBackup(file);
      return Response.json({ ok: true } satisfies OkResponse);
    }
    return null;
  }

  if (a === 'orders.csv' && !b && method === 'GET') {
    return new Response(store.ordersCsv(), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${store.seller.slug}.csv"`,
      },
    });
  }

  if (a === 'orders') {
    const actor = actorOf(request);
    if (!b && method === 'GET') {
      return Response.json({ orders: store.listOrders() } satisfies SellerOrdersResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateSellerOrderRequest(await readJson(request));
      return input ? sellerResult(store.createSellerOrder(input, actor), 201) : bad();
    }
    const code = b ? parseOrderCode(b) : null;
    if (b && !c && method === 'GET') {
      const order = code ? store.getByCode(code) : undefined;
      return order
        ? Response.json({ order } satisfies SellerOrderResponse)
        : error('not_found', 'Order not found');
    }
    if (b && c === 'status' && method === 'POST') {
      const input = parseSetStatusRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setStatus(code, input.to, actor))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'paid' && method === 'POST') {
      const input = parseSetPaidRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setPaid(code, input.paid, actor))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'lock' && method === 'POST') {
      const input = parseSetLockedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setLocked(code, input.locked))
        : error('not_found', 'Order not found');
    }
    if (b && c === 'wa-received' && method === 'POST') {
      const input = parseSetWaReceivedRequest(await readJson(request));
      if (!input) return bad();
      return code
        ? sellerResult(store.setWaReceived(code, input.received))
        : error('not_found', 'Order not found');
    }
    if (b && (c === 'nudge' || c === 'seen') && method === 'POST') {
      if (!code) return error('not_found', 'Order not found');
      return sellerResult(c === 'nudge' ? store.nudge(code) : store.markSeen(code));
    }
  }
  return null;
}
