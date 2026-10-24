// Old order links keep working forever (plan 102, risk 1): `/o/<token>[/sub][?query]` and an order
// link under the wrong kitchen both answer 302 to `/<real slug>/o/<token>[/sub][?query]`. The slug
// comes from the token itself. Done in the Worker, so it never depends on the app being loaded.
import { orderPath, parseOrderPath } from '../shared/orderPath';
import type { Repository } from './repo/Repository';

/**
 * The redirect for this address, or null: not an order address, the slug is already right, the
 * token is unknown (the app shows its own "not found") or the lookup failed (fail-open: the page is
 * served as before).
 */
export async function orderRedirect(
  store: Pick<Repository, 'lookupByToken'>,
  requestUrl: string,
): Promise<Response | null> {
  const url = new URL(requestUrl);
  const parsed = parseOrderPath(url.pathname);
  if (parsed === null) return null;
  try {
    const found = await store.lookupByToken(parsed.token);
    if (!found) return null;
    const { slug } = found.sellerRepo.seller;
    if (parsed.slug === slug) return null;
    // The sub-page is kept as written; the query too (`?source=homescreen`). The hash never reaches us
    // and the browser keeps it across the redirect.
    const location = orderPath(slug, parsed.token, parsed.sub) + url.search;
    return new Response(null, {
      status: 302,
      headers: { Location: location, 'Cache-Control': 'no-store' },
    });
  } catch {
    return null;
  }
}
