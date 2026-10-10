// Seller calls for Kitchen · Pack (plan 001, stage 8). Same shape as client.ts: `(actor?, seller?)` last.
import type { StaffActor } from '../../shared/domain';
import type { PackRequest } from '../../shared/handoverContract';
import { parseSellerOrderResponse, type SellerOrderResponse } from '../../shared/orderContract';
import { request, type ApiResult } from './http';

/**
 * Saves the ticked items and / or the packed flag (D-066). `ticked` is the whole set of ticked
 * item ids. Packing with items unticked answers 409 with a `warning`; send it again with
 * `force: true` (D-062). Packing never changes the order status.
 */
export function packOrder(
  code: string,
  body: PackRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<SellerOrderResponse>> {
  return request(`/api/seller/orders/${encodeURIComponent(code)}/pack`, parseSellerOrderResponse, {
    method: 'POST',
    body,
    ...(actor ? { actor } : {}),
    ...(seller ? { seller } : {}),
  });
}
