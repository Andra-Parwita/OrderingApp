import {
  parseResetResponse,
  parseSampleOrdersResponse,
  type ResetResponse,
  type SampleOrdersResponse,
} from '../../shared/devContract';
import type { StaffActor } from '../../shared/domain';
import { parseMenuResponse, type MenuResponse } from '../../shared/menuContract';
import {
  parseOrderResponse,
  parseOrdersResponse,
  type CreateOrderRequest,
  type OrderResponse,
  type OrdersResponse,
  type UpdateOrderRequest,
} from '../../shared/orderContract';
import type { OrderStatus } from '../../shared/domain';
import { request, type ApiResult } from './http';

const enc = encodeURIComponent;

export function fetchMenu(): Promise<ApiResult<MenuResponse>> {
  return request('/api/menu', parseMenuResponse);
}

// Customer, by private token.
export function createOrder(input: CreateOrderRequest): Promise<ApiResult<OrderResponse>> {
  return request('/api/orders', parseOrderResponse, { method: 'POST', body: input });
}

export function fetchOrder(token: string): Promise<ApiResult<OrderResponse>> {
  return request(`/api/orders/${enc(token)}`, parseOrderResponse);
}

export function updateOrder(
  token: string,
  patch: UpdateOrderRequest,
): Promise<ApiResult<OrderResponse>> {
  return request(`/api/orders/${enc(token)}`, parseOrderResponse, { method: 'PATCH', body: patch });
}

export function cancelOrder(token: string): Promise<ApiResult<OrderResponse>> {
  return request(`/api/orders/${enc(token)}/cancel`, parseOrderResponse, { method: 'POST' });
}

// Seller (and chef). `code` is the raw or displayed order code.
export function fetchSellerOrders(actor?: StaffActor): Promise<ApiResult<OrdersResponse>> {
  return request('/api/seller/orders', parseOrdersResponse, { ...(actor ? { actor } : {}) });
}

export function fetchSellerOrder(
  code: string,
  actor?: StaffActor,
): Promise<ApiResult<OrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}`, parseOrderResponse, {
    ...(actor ? { actor } : {}),
  });
}

export function createSellerOrder(
  input: CreateOrderRequest,
  actor?: StaffActor,
): Promise<ApiResult<OrderResponse>> {
  return request('/api/seller/orders', parseOrderResponse, {
    method: 'POST',
    body: input,
    ...(actor ? { actor } : {}),
  });
}

export function setOrderStatus(
  code: string,
  to: OrderStatus,
  actor?: StaffActor,
): Promise<ApiResult<OrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}/status`, parseOrderResponse, {
    method: 'POST',
    body: { to },
    ...(actor ? { actor } : {}),
  });
}

export function setOrderPaid(
  code: string,
  paid: boolean,
  actor?: StaffActor,
): Promise<ApiResult<OrderResponse>> {
  return request(`/api/seller/orders/${enc(code)}/paid`, parseOrderResponse, {
    method: 'POST',
    body: { paid },
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
