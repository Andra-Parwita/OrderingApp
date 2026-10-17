// Seller calls for plan 081 (private orders). Writes are the owner's; the server refuses the rest.
import { isRecord } from '../../shared/parse';
import {
  parseSellerOrderResponse,
  parseSellerOrdersResponse,
  type SellerOrderResponse,
} from '../../shared/orderContract';
import type {
  CreatePrivateRequest,
  PrivateChefSummaryResponse,
  PrivateDue,
  PrivateListResponse,
  UpdatePrivateRequest,
} from '../../shared/privateContract';
import { request, type ApiResult } from './http';

const enc = encodeURIComponent;

function parseDue(input: unknown): PrivateDue | null {
  if (!isRecord(input)) return null;
  const { today, tomorrow } = input;
  return typeof today === 'number' && typeof tomorrow === 'number' ? { today, tomorrow } : null;
}

function parseList(input: unknown): PrivateListResponse | null {
  const orders = parseSellerOrdersResponse(input);
  if (!orders || !isRecord(input)) return null;
  const due = parseDue(input['due']);
  const today = input['today'];
  return due && typeof today === 'string' ? { orders: orders.orders, due, today } : null;
}

function parseChefSummary(input: unknown): PrivateChefSummaryResponse | null {
  if (!isRecord(input) || typeof input['date'] !== 'string' || !Array.isArray(input['rows'])) {
    return null;
  }
  return input as unknown as PrivateChefSummaryResponse;
}

function opts(seller?: string) {
  return seller ? { seller } : {};
}

/** `view` upcoming (default) or past; `day: 'today'` the kitchen's today (overrides view); `dueOnly` answers the today / tomorrow counts and no orders. */
export function fetchPrivate(
  query: { view?: 'upcoming' | 'past'; dueOnly?: boolean; day?: 'today' },
  seller?: string,
): Promise<ApiResult<PrivateListResponse>> {
  const params = new URLSearchParams();
  if (query.dueOnly) params.set('due', '1');
  else if (query.day) params.set('day', query.day);
  else if (query.view) params.set('view', query.view);
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return request(`/api/seller/private${suffix}`, parseList, opts(seller));
}

export function createPrivate(
  input: CreatePrivateRequest,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request('/api/seller/private', parseSellerOrderResponse, {
    method: 'POST',
    body: input,
    ...opts(seller),
  });
}

export function updatePrivate(
  code: string,
  input: UpdatePrivateRequest,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/private/${enc(code)}`, parseSellerOrderResponse, {
    method: 'PATCH',
    body: input,
    ...opts(seller),
  });
}

export function cancelPrivate(
  code: string,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/private/${enc(code)}/cancel`, parseSellerOrderResponse, {
    method: 'POST',
    ...opts(seller),
  });
}

export function fetchPrivateChefSummary(
  date: string,
  seller?: string,
): Promise<ApiResult<PrivateChefSummaryResponse>> {
  return request(
    `/api/seller/private/chef-summary?date=${enc(date)}`,
    parseChefSummary,
    opts(seller),
  );
}
