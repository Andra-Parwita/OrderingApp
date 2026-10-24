// The one place that writes and reads an order page's address (plan 102 stage 4). An order lives under
// its kitchen: `/<slug>/o/<token>[/placed|/qr|/edit|/edit/name]`. The old `/o/<token>[...]` links
// (WhatsApp, notifications, bookmarks) are still read and are redirected by the Worker (worker/redirects.ts).
import { isValidSlug } from './seller';

/** The page a home-screen app opens first (the first-open code in OrderScreen reads it). */
export const ORDER_HOME_SOURCE = 'homescreen';

/** `/<slug>/o/<token>` plus an optional sub-page: '', '/placed', '/qr', '/edit' or '/edit/name'. */
export const orderPath = (slug: string, token: string, sub = ''): string =>
  `/${slug}/o/${encodeURIComponent(token)}${sub}`;

/** The order page a home-screen app starts on. */
export const orderStartPath = (slug: string, token: string): string =>
  `${orderPath(slug, token)}?source=${ORDER_HOME_SOURCE}`;

/** `slug` is null for the old shape `/o/<token>`. `sub` is '' or e.g. '/qr' (raw, as in the address). */
export type ParsedOrderPath = Readonly<{ slug: string | null; token: string; sub: string }>;

const decode = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/**
 * Reads a same-origin path or relative URL in either shape: `/o/<token>[/...]` or
 * `/<slug>/o/<token>[/...]`. Query and hash are ignored. Anything else is null.
 */
export function parseOrderPath(url: unknown): ParsedOrderPath | null {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return null;
  const parts = (url.split(/[?#]/)[0] ?? '').split('/').slice(1);
  let at = 0;
  let slug: string | null = null;
  if (parts[0] !== 'o') {
    const first = parts[0];
    if (!isValidSlug(first) || parts[1] !== 'o') return null;
    slug = first;
    at = 1;
  }
  const token = parts[at + 1];
  if (token === undefined || token === '') return null;
  const rest = parts.slice(at + 2);
  while (rest.at(-1) === '') rest.pop();
  return { slug, token: decode(token), sub: rest.length === 0 ? '' : `/${rest.join('/')}` };
}

/**
 * The old `/o/<token>` address, for the one case that cannot name a kitchen: a My orders entry saved
 * before orders kept their kitchen. The Worker (or the app's `/o/:token` route) moves it under the
 * real kitchen. Nothing else builds this shape.
 */
export const unresolvedOrderPath = (token: string): string => `/o/${encodeURIComponent(token)}`;
