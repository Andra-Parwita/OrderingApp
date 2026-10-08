import type { Seller } from './domain';
import { isInt, isRecord, parseArray } from './parse';
import { parseSeller } from './seller';

/** POST /api/dev/sample-orders (dev only; adds to the X-Seller seller). */
export type SampleOrdersRequest = { count: number };
export type SampleOrdersResponse = { added: number };
/** POST /api/dev/reset (dev only). */
export type ResetResponse = { ok: true };

export function parseSampleOrdersRequest(input: unknown): SampleOrdersRequest | null {
  if (!isRecord(input) || !isInt(input['count'], 1, 200)) return null;
  return { count: input['count'] };
}

export function parseSampleOrdersResponse(input: unknown): SampleOrdersResponse | null {
  if (!isRecord(input) || !isInt(input['added'], 0, 200)) return null;
  return { added: input['added'] };
}

export function parseResetResponse(input: unknown): ResetResponse | null {
  return isRecord(input) && input['ok'] === true ? { ok: true } : null;
}

/** GET /api/dev/sellers (dev only): feeds the dev seller picker. */
export type DevSellersResponse = { sellers: Array<Seller> };

export function parseDevSellersResponse(input: unknown): DevSellersResponse | null {
  if (!isRecord(input)) return null;
  const sellers = parseArray(input['sellers'], parseSeller);
  return sellers ? { sellers } : null;
}
