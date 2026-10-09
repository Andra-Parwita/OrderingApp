import {
  parseDevSellersResponse,
  parseResetResponse,
  parseSampleOrdersResponse,
  type DevSellersResponse,
  type ResetResponse,
  type SampleOrdersResponse,
} from '../../shared/devContract';
import type { KitchenSettings, OrderStatus, StaffActor } from '../../shared/domain';
import {
  parseMenuResponse,
  parseSellerMenuResponse,
  type MenuResponse,
  type SellerMenuResponse,
} from '../../shared/menuContract';
import {
  parseCustomerOrderResponse,
  parseCustomerOrdersResponse,
  parseFetchedOrderResponse,
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
  type CreateOrderRequest,
  type CreateSellerOrderRequest,
  type CustomerOrderResponse,
  type CustomerOrdersResponse,
  type FetchedOrderResponse,
  type SellerOrderResponse,
  type SellerOrdersResponse,
  type UpdateOrderRequest,
} from '../../shared/orderContract';
import { parseSettingsResponse, type SettingsResponse } from '../../shared/sellerContract';
import { parseBackupFile, type BackupFile } from '../../shared/backup';
import type { ImageSlot } from '../../shared/imageSlots';
import {
  parsePastWeekResponse,
  parsePastWeeksResponse,
  type PastWeekResponse,
  type PastWeeksResponse,
} from '../../shared/pastWeeks';
import {
  parseChefResponse,
  parseChefsResponse,
  parseCloseWeekResponse,
  parseImagesResponse,
  parseItemResponse,
  parseItemsResponse,
  parseOkResponse,
  parseSetResponse,
  parseSetsResponse,
  parseWeekResponse,
  type ChefResponse,
  type ChefsResponse,
  type CloseWeekResponse,
  type CreateItemRequest,
  type ImagesResponse,
  type ImageStyleRequest,
  type ItemResponse,
  type ItemsResponse,
  type OkResponse,
  type SetResponse,
  type SetsResponse,
  type UpdateItemRequest,
  type UseSetRequest,
  type WeekResponse,
  type WeekSettingsRequest,
} from '../../shared/setupContract';
import { request, requestText, type ApiResult } from './http';

const enc = encodeURIComponent;

/**
 * Seller calls end with `(actor?, seller?)`: the audit name, then the seller's slug for the dev
 * `X-Seller` header. Without a slug the mock uses its default seller; phase 4 replaces the
 * header with the signed-in session.
 */
function who(actor?: StaffActor, seller?: string) {
  return { ...(actor ? { actor } : {}), ...(seller ? { seller } : {}) };
}

// Customer, public, per seller (D-037).
export function fetchMenu(slug: string): Promise<ApiResult<MenuResponse>> {
  return request(`/api/s/${enc(slug)}/menu`, parseMenuResponse);
}

export function placeOrder(
  slug: string,
  input: CreateOrderRequest,
): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/s/${enc(slug)}/orders`, parseCustomerOrderResponse, {
    method: 'POST',
    body: input,
  });
}

export function fetchSellerMenu(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerMenuResponse>> {
  return request('/api/seller/menu', parseSellerMenuResponse, who(actor, seller));
}

// Customer, by private token (global, not seller-scoped). These return the customer view of the
// order, which says which seller it belongs to.
export function fetchOrder(token: string): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/orders/${enc(token)}`, parseCustomerOrderResponse);
}

/** Like `fetchOrder`, for the order page: a closed week's order may be archived or expired (D-044). */
export function fetchOrderOrExpired(token: string): Promise<ApiResult<FetchedOrderResponse>> {
  return request(`/api/orders/${enc(token)}`, parseFetchedOrderResponse);
}

/** My orders: up to 20 tokens, across sellers; unknown tokens are simply missing from the answer. */
export function fetchMyOrders(
  tokens: ReadonlyArray<string>,
): Promise<ApiResult<CustomerOrdersResponse>> {
  return request(`/api/orders?tokens=${enc(tokens.join(','))}`, parseCustomerOrdersResponse);
}

export function updateOrder(
  token: string,
  patch: UpdateOrderRequest,
): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/orders/${enc(token)}`, parseCustomerOrderResponse, {
    method: 'PATCH',
    body: patch,
  });
}

export function cancelOrder(token: string): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/orders/${enc(token)}/cancel`, parseCustomerOrderResponse, {
    method: 'POST',
  });
}

// Seller (and chef). `code` is the raw or displayed order code. These return the full order.
export function fetchSellerOrders(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrdersResponse>> {
  return request('/api/seller/orders', parseSellerOrdersResponse, who(actor, seller));
}

export function fetchSellerOrder(
  code: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}`, parseSellerOrderResponse, who(actor, seller));
}

export function createSellerOrder(
  input: CreateSellerOrderRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request('/api/seller/orders', parseSellerOrderResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}

function sellerPost(
  code: string,
  action: string,
  body: unknown,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}/${action}`, parseSellerOrderResponse, {
    method: 'POST',
    ...(body !== undefined ? { body } : {}),
    ...who(actor, seller),
  });
}

export function setOrderStatus(
  code: string,
  to: OrderStatus,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'status', { to }, actor, seller);
}

export function setOrderPaid(
  code: string,
  paid: boolean,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'paid', { paid }, actor, seller);
}

export function setOrderLocked(
  code: string,
  locked: boolean,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'lock', { locked }, actor, seller);
}

export function setOrderWaReceived(
  code: string,
  received: boolean,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'wa-received', { received }, actor, seller);
}

export function nudgeOrder(
  code: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'nudge', undefined, actor, seller);
}

/** The seller has seen the customer's change. */
export function markOrderSeen(
  code: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'seen', undefined, actor, seller);
}

export function fetchSettings(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SettingsResponse>> {
  return request('/api/seller/settings', parseSettingsResponse, who(actor, seller));
}

/** Replaces the settings; the server normalises the WhatsApp number. */
export function saveSettings(
  settings: KitchenSettings,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SettingsResponse>> {
  return request('/api/seller/settings', parseSettingsResponse, {
    method: 'PUT',
    body: settings,
    ...who(actor, seller),
  });
}

// Dev only (the Worker has these routes only in dev).
/** Adds sample orders to the `seller` (default: the mock's default seller). */
export function addSampleOrders(
  count: number,
  seller?: string,
): Promise<ApiResult<SampleOrdersResponse>> {
  return request('/api/dev/sample-orders', parseSampleOrdersResponse, {
    method: 'POST',
    body: { count },
    ...who(undefined, seller),
  });
}

/** Resets every seller. */
export function resetMock(): Promise<ApiResult<ResetResponse>> {
  return request('/api/dev/reset', parseResetResponse, { method: 'POST' });
}

/** For the dev seller picker. */
export function fetchDevSellers(): Promise<ApiResult<DevSellersResponse>> {
  return request('/api/dev/sellers', parseDevSellersResponse);
}

// ---- Seller setup (stage 6.1) ----

export function fetchWeek(actor?: StaffActor, seller?: string): Promise<ApiResult<WeekResponse>> {
  return request('/api/seller/week', parseWeekResponse, who(actor, seller));
}

export function saveWeek(
  input: WeekSettingsRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<WeekResponse>> {
  return request('/api/seller/week', parseWeekResponse, {
    method: 'PUT',
    body: input,
    ...who(actor, seller),
  });
}

/** 409 `no_items` when the menu is empty. */
export function publishWeek(actor?: StaffActor, seller?: string): Promise<ApiResult<WeekResponse>> {
  return request('/api/seller/week/publish', parseWeekResponse, {
    method: 'POST',
    ...who(actor, seller),
  });
}

export function unpublishWeek(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<WeekResponse>> {
  return request('/api/seller/week/unpublish', parseWeekResponse, {
    method: 'POST',
    ...who(actor, seller),
  });
}

/** Archives the week into Past weeks and starts the next draft week. */
export function closeWeek(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<CloseWeekResponse>> {
  return request('/api/seller/week/close', parseCloseWeekResponse, {
    method: 'POST',
    ...who(actor, seller),
  });
}

/** 409 `limit_reached` at 10 items. */
export function createItem(
  input: CreateItemRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ItemResponse>> {
  return request('/api/seller/menu/items', parseItemResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}

/** Edits only affect new orders (D-020). `soldOut` is the manual switch. */
export function updateItem(
  id: string,
  patch: UpdateItemRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ItemResponse>> {
  return request(`/api/seller/menu/items/${enc(id)}`, parseItemResponse, {
    method: 'PATCH',
    body: patch,
    ...who(actor, seller),
  });
}

/** 409 `item_has_orders` when the item has orders: mark it sold out instead. */
export function deleteItem(
  id: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<OkResponse>> {
  return request(`/api/seller/menu/items/${enc(id)}`, parseOkResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

export function reorderItems(
  ids: ReadonlyArray<string>,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ItemsResponse>> {
  return request('/api/seller/menu/order', parseItemsResponse, {
    method: 'PUT',
    body: { ids },
    ...who(actor, seller),
  });
}

export function fetchChefs(actor?: StaffActor, seller?: string): Promise<ApiResult<ChefsResponse>> {
  return request('/api/seller/chefs', parseChefsResponse, who(actor, seller));
}

export function createChef(
  name: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ChefResponse>> {
  return request('/api/seller/chefs', parseChefResponse, {
    method: 'POST',
    body: { name },
    ...who(actor, seller),
  });
}

export function renameChef(
  id: string,
  name: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ChefResponse>> {
  return request(`/api/seller/chefs/${enc(id)}`, parseChefResponse, {
    method: 'PATCH',
    body: { name },
    ...who(actor, seller),
  });
}

/** Their items become unassigned. */
export function deleteChef(
  id: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<OkResponse>> {
  return request(`/api/seller/chefs/${enc(id)}`, parseOkResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

export function fetchSets(actor?: StaffActor, seller?: string): Promise<ApiResult<SetsResponse>> {
  return request('/api/seller/sets', parseSetsResponse, who(actor, seller));
}

/** Saves this week's items and images; a 6th set needs `replaceSetId` (else 409 `limit_reached`). */
export function saveSet(
  name: string,
  replaceSetId?: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SetResponse>> {
  return request('/api/seller/sets', parseSetResponse, {
    method: 'POST',
    body: { name, ...(replaceSetId ? { replaceSetId } : {}) },
    ...who(actor, seller),
  });
}

export function renameSet(
  id: string,
  name: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SetResponse>> {
  return request(`/api/seller/sets/${enc(id)}`, parseSetResponse, {
    method: 'PATCH',
    body: { name },
    ...who(actor, seller),
  });
}

export function deleteSet(
  id: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<OkResponse>> {
  return request(`/api/seller/sets/${enc(id)}`, parseOkResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

/** Replaces the draft week's items; send `confirm: true` when the week already has items. */
export function useSet(
  id: string,
  options: UseSetRequest = {},
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ItemsResponse>> {
  return request(`/api/seller/sets/${enc(id)}/use`, parseItemsResponse, {
    method: 'POST',
    body: options,
    ...who(actor, seller),
  });
}

export function fetchImages(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ImagesResponse>> {
  return request('/api/seller/images', parseImagesResponse, who(actor, seller));
}

/** `dataUrl` is already resized to slotSpec(slot); the server checks type, size and shape. */
export function uploadImage(
  slot: ImageSlot,
  dataUrl: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ImagesResponse>> {
  return request(`/api/seller/images/${enc(slot)}`, parseImagesResponse, {
    method: 'PUT',
    body: { dataUrl },
    ...who(actor, seller),
  });
}

export function removeImage(
  slot: ImageSlot,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ImagesResponse>> {
  return request(`/api/seller/images/${enc(slot)}`, parseImagesResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

/** Banner colour and alt text. */
export function saveImageStyle(
  style: ImageStyleRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<ImagesResponse>> {
  return request('/api/seller/images', parseImagesResponse, {
    method: 'PUT',
    body: style,
    ...who(actor, seller),
  });
}

export function fetchPastWeeks(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PastWeeksResponse>> {
  return request('/api/seller/past-weeks', parsePastWeeksResponse, who(actor, seller));
}

export function fetchPastWeek(
  id: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PastWeekResponse>> {
  return request(`/api/seller/past-weeks/${enc(id)}`, parsePastWeekResponse, who(actor, seller));
}

export function exportBackup(actor?: StaffActor, seller?: string): Promise<ApiResult<BackupFile>> {
  return request('/api/seller/backup', parseBackupFile, who(actor, seller));
}

/** Replaces this seller's data with the backup (400 `invalid_backup` if it is not valid). */
export function restoreBackup(
  file: BackupFile,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<OkResponse>> {
  return request('/api/seller/backup', parseOkResponse, {
    method: 'POST',
    body: file,
    ...who(actor, seller),
  });
}

/** The week's orders as CSV text (UTF-8 with a BOM, for Excel). */
export function fetchOrdersCsv(actor?: StaffActor, seller?: string): Promise<ApiResult<string>> {
  return requestText('/api/seller/orders.csv', who(actor, seller));
}
