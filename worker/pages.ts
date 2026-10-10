// Pages from the static assets, with the kitchen's manifest and icon links added to the head (plan 011).
// Apart from api/ because HTMLRewriter exists only in the Worker runtime, not in the unit tests.
import { kitchenHeadFor } from './api/kitchenPage';
import { sessionTokenOf } from './auth/cookie';
import { createD1Repository } from './db';
import type { D1Like } from './db/d1';

/**
 * The page with its kitchen's links when the path belongs to a kitchen or an order. Anything else
 * (not an HTML page, an unknown kitchen, a failed lookup) is the page as it is.
 */
export async function withKitchenLinks(
  request: Request,
  env: { DB: D1Like },
  page: Response,
): Promise<Response> {
  if (request.method !== 'GET' || !page.headers.get('Content-Type')?.includes('text/html')) {
    return page;
  }
  try {
    const repo = createD1Repository(env.DB, {
      now: () => new Date(),
      adminSetupKey: crypto.randomUUID(), // never used: this only reads
    });
    const html = await kitchenHeadFor(repo, new URL(request.url).pathname, sessionTokenOf(request));
    if (html === null) return page;
    const rewritten = new HTMLRewriter()
      .on('head', {
        element(head) {
          head.append(html, { html: true });
        },
      })
      .transform(page);
    // The head now depends on the kitchen or the session: the file's own validators and caching no longer fit.
    rewritten.headers.delete('ETag');
    rewritten.headers.set('Cache-Control', 'no-cache');
    return rewritten;
  } catch {
    return page;
  }
}
