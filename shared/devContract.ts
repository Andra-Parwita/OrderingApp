import type { Seller } from './domain';
import { isInt, isRecord, parseArray } from './parse';
import { parseSeller } from './seller';

/** POST /api/dev/sample-orders (dev only; adds to the X-Seller seller). */
export type SampleOrdersRequest = { count: number };
/**
 * `added` is how many orders went in. `reason` says why fewer than asked: `no_menu` (no current
 * menu, or it has no dishes) or `sold_out` (what is left of the limits did not fit the rest).
 * Never an error status for "nothing fits".
 */
export type SampleOrdersResponse = { added: number; reason?: 'no_menu' | 'sold_out' };
/** POST /api/dev/reset (dev only). */
export type ResetResponse = { ok: true };

export function parseSampleOrdersRequest(input: unknown): SampleOrdersRequest | null {
  if (!isRecord(input) || !isInt(input['count'], 1, 200)) return null;
  return { count: input['count'] };
}

export function parseSampleOrdersResponse(input: unknown): SampleOrdersResponse | null {
  if (!isRecord(input) || !isInt(input['added'], 0, 200)) return null;
  const reason = input['reason'];
  if (reason === undefined) return { added: input['added'] };
  if (reason !== 'no_menu' && reason !== 'sold_out') return null;
  return { added: input['added'], reason };
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
