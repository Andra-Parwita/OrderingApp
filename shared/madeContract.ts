// Plan 035 stage 4: how many of each dish are made, shared by every device of a kitchen.
// `made[itemId] = n` for the current menu. Customers never get this.
import { isInt, isRecord } from './parse';

export const MADE_MAX = 9999;
const ID_MAX = 64;

export type MadeResponse = { made: Record<string, number> };
/** Moves one dish's count by `delta` (never below 0); the server adds, so taps cannot be lost. */
export type AddMadeRequest = { itemId: string; delta: number };

export function parseMadeResponse(input: unknown): MadeResponse | null {
  if (!isRecord(input) || !isRecord(input['made'])) return null;
  const made: Record<string, number> = {};
  for (const [id, count] of Object.entries(input['made'])) {
    if (!isInt(count, 0, MADE_MAX)) return null;
    made[id] = count;
  }
  return { made };
}

export function parseAddMadeRequest(input: unknown): AddMadeRequest | null {
  if (!isRecord(input)) return null;
  const { itemId, delta } = input;
  if (typeof itemId !== 'string' || itemId === '' || itemId.length > ID_MAX) return null;
  if (!isInt(delta, -MADE_MAX, MADE_MAX) || delta === 0) return null;
  return { itemId, delta };
}
