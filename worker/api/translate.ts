// Plan 057: POST /api/seller/translate {text, from, to} -> {text}. Fills the other language of a dish
// text from the one typed. Owner and chef only (a helper is refused by the deny-by-default list).
// Cloudflare Workers AI (binding `AI`); at most 100 translations per kitchen per day, counted in the
// kitchen's SellerLive Durable Object. No AI binding or an AI error is 503 and is never retried.
import { isOneOf, isRecord } from '../../shared/parse';
import { error, readJson } from './respond';

export const TRANSLATE_MODEL = '@cf/meta/m2m100-1.2b';
export const TRANSLATE_DAILY_CAP = 100;
export const TRANSLATE_MAX_CHARS = 500;
const LANGS = ['en', 'id'] as const;

/** The part of the Workers AI binding that is used; the real binding fits it. */
export type AiLike = {
  run(
    model: string,
    input: { text: string; source_lang: string; target_lang: string },
  ): Promise<unknown>;
};

/** What the hosting Worker offers the route. Absent (or no `ai`) means translation is unavailable. */
export type TranslateContext = {
  ai?: AiLike | undefined;
  /** Takes one of today's slots for the kitchen; false when the daily cap is used up. */
  takeSlot?: (sellerId: string, day: string, cap: number) => Promise<boolean>;
};

type Lang = (typeof LANGS)[number];

function parseRequest(input: unknown): { text: string; from: Lang; to: Lang } | null {
  if (!isRecord(input)) return null;
  const { text, from, to } = input;
  if (typeof text !== 'string' || !isOneOf(LANGS, from) || !isOneOf(LANGS, to) || from === to) {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.length > TRANSLATE_MAX_CHARS) return null;
  return { text: trimmed, from, to };
}

export async function handleTranslate(
  request: Request,
  sellerId: string,
  context: TranslateContext | undefined,
  now: Date = new Date(),
): Promise<Response> {
  const input = parseRequest(await readJson(request));
  if (!input) return error('invalid_request', 'Invalid request');
  const unavailable = () => error('translate_unavailable', 'Translation is not available');
  if (!context?.ai || !context.takeSlot) return unavailable();
  const day = now.toISOString().slice(0, 10);
  try {
    if (!(await context.takeSlot(sellerId, day, TRANSLATE_DAILY_CAP))) {
      return error('translate_limit', 'Translation is resting for today');
    }
    const out = await context.ai.run(TRANSLATE_MODEL, {
      text: input.text,
      source_lang: input.from,
      target_lang: input.to,
    });
    const text = isRecord(out) ? out['translated_text'] : undefined;
    if (typeof text !== 'string' || text.trim() === '') return unavailable();
    return Response.json({ text: text.trim() });
  } catch {
    return unavailable();
  }
}
