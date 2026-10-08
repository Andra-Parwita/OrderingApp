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
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
  type CreateOrderRequest,
  type CreateSellerOrderRequest,
  type CustomerOrderResponse,
  type CustomerOrdersResponse,
  type SellerOrderResponse,
  type SellerOrdersResponse,
  type UpdateOrderRequest,
} from '../../shared/orderContract';
import { parseSettingsResponse, type SettingsResponse } from '../../shared/sellerContract';
import { request, type ApiResult } from './http';

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
