// Seller call to rename the kitchen (plan 001, stage 11). Same shape as client.ts: `(actor?, seller?)` last.
import type { StaffActor } from '../../shared/domain';
import { parseKitchenNameResponse, type KitchenNameResponse } from '../../shared/setupContract';
import { request, type ApiResult } from './http';

/** Owner only (403 for a chef). The name is trimmed and at most 60 characters (400 otherwise). */
export function setKitchenName(
  name: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<KitchenNameResponse>> {
  return request('/api/seller/kitchen/name', parseKitchenNameResponse, {
    method: 'PUT',
    body: { name },
    ...(actor ? { actor } : {}),
    ...(seller ? { seller } : {}),
  });
}
