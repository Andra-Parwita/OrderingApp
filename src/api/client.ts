import {
  parseResetResponse,
  parseSampleOrdersResponse,
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

export function fetchMenu(): Promise<ApiResult<MenuResponse>> {
  return request('/api/menu', parseMenuResponse);
}

export function fetchSellerMenu(actor?: StaffActor): Promise<ApiResult<SellerMenuResponse>> {
  return request('/api/seller/menu', parseSellerMenuResponse, { ...(actor ? { actor } : {}) });
}

// Customer, by private token. These return the customer view of the order.
export function createOrder(input: CreateOrderRequest): Promise<ApiResult<CustomerOrderResponse>> {
  return request('/api/orders', parseCustomerOrderResponse, { method: 'POST', body: input });
}

export function fetchOrder(token: string): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/orders/${enc(token)}`, parseCustomerOrderResponse);
}

/** My orders: up to 20 tokens; unknown tokens are simply missing from the answer. */
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
export function fetchSellerOrders(actor?: StaffActor): Promise<ApiResult<SellerOrdersResponse>> {
  return request('/api/seller/orders', parseSellerOrdersResponse, { ...(actor ? { actor } : {}) });
}

export function fetchSellerOrder(
  code: string,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}`, parseSellerOrderResponse, {
    ...(actor ? { actor } : {}),
  });
}

export function createSellerOrder(
  input: CreateSellerOrderRequest,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return request('/api/seller/orders', parseSellerOrderResponse, {
    method: 'POST',
    body: input,
    ...(actor ? { actor } : {}),
  });
}

function sellerPost(
  code: string,
  action: string,
  body?: unknown,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}/${action}`, parseSellerOrderResponse, {
    method: 'POST',
    ...(body !== undefined ? { body } : {}),
    ...(actor ? { actor } : {}),
  });
}

export function setOrderStatus(
  code: string,
  to: OrderStatus,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'status', { to }, actor);
}

export function setOrderPaid(
  code: string,
  paid: boolean,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'paid', { paid }, actor);
}

export function setOrderLocked(
  code: string,
  locked: boolean,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'lock', { locked }, actor);
}

export function setOrderWaReceived(
  code: string,
  received: boolean,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'wa-received', { received }, actor);
}

export function nudgeOrder(
  code: string,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'nudge', undefined, actor);
}

/** The seller has seen the customer's change. */
export function markOrderSeen(
  code: string,
  actor?: StaffActor,
): Promise<ApiResult<SellerOrderResponse>> {
  return sellerPost(code, 'seen', undefined, actor);
}

export function fetchSettings(actor?: StaffActor): Promise<ApiResult<SettingsResponse>> {
  return request('/api/seller/settings', parseSettingsResponse, { ...(actor ? { actor } : {}) });
}

/** Replaces the settings; the server normalises the WhatsApp number. */
export function saveSettings(
  settings: KitchenSettings,
  actor?: StaffActor,
): Promise<ApiResult<SettingsResponse>> {
  return request('/api/seller/settings', parseSettingsResponse, {
    method: 'PUT',
    body: settings,
    ...(actor ? { actor } : {}),
  });
}

// Dev only (the Worker has these routes only in dev).
export function addSampleOrders(count: number): Promise<ApiResult<SampleOrdersResponse>> {
  return request('/api/dev/sample-orders', parseSampleOrdersResponse, {
    method: 'POST',
    body: { count },
  });
}

export function resetMock(): Promise<ApiResult<ResetResponse>> {
  return request('/api/dev/reset', parseResetResponse, { method: 'POST' });
}
