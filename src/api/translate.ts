// Seller call to translate a dish text (plan 057). Same shape as client.ts: `(actor?, seller?)` last.
import type { StaffActor } from '../../shared/domain';
import { isRecord } from '../../shared/parse';
import { request, type ApiResult } from './http';

export type TranslateLang = 'en' | 'id';
export type TranslateResponse = { text: string };

function parseTranslateResponse(input: unknown): TranslateResponse | null {
  return isRecord(input) && typeof input['text'] === 'string' ? { text: input['text'] } : null;
}

/**
 * Owner or chef (helper 403). Text is at most 500 characters (400 otherwise). 429 `translate_limit`:
 * the kitchen's 100 for today are used. 503 `translate_unavailable`: no translator; do not retry.
 */
export function translateText(
  text: string,
  from: TranslateLang,
  to: TranslateLang,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<TranslateResponse>> {
  return request('/api/seller/translate', parseTranslateResponse, {
    method: 'POST',
    body: { text, from, to },
    ...(actor ? { actor } : {}),
    ...(seller ? { seller } : {}),
  });
}
