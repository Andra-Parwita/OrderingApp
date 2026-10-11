// Seller calls for the shared made counts on the Cook screen (plan 035, stage 4).
import type { StaffActor } from '../../shared/domain';
import {
  parseMadeResponse,
  type AddMadeRequest,
  type MadeResponse,
} from '../../shared/madeContract';
import { request, type ApiResult } from './http';

export function fetchMade(actor?: StaffActor, seller?: string): Promise<ApiResult<MadeResponse>> {
  return request('/api/seller/made', parseMadeResponse, {
    ...(actor ? { actor } : {}),
    ...(seller ? { seller } : {}),
  });
}

/** Adds `delta` (±) to one dish's count on the server; answers with every count. */
export function addMade(
  body: AddMadeRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MadeResponse>> {
  return request('/api/seller/made', parseMadeResponse, {
    method: 'POST',
    body,
    ...(actor ? { actor } : {}),
    ...(seller ? { seller } : {}),
  });
}
