import { isInt, isRecord } from './parse';

/** POST /api/dev/sample-orders (dev only). */
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
