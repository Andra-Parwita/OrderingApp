// Pages from the static assets, with the kitchen's manifest and icon links added to the head (plan 011).
// Apart from api/ because HTMLRewriter exists only in the Worker runtime, not in the unit tests.
import {
  defaultPreview,
  defaultSellerHeadHtml,
  isSellerPath,
  linkPreviewHtml,
} from '../shared/kitchenHeadLinks';
import { kitchenPageFor } from './api/kitchenPage';
import { createD1Repository } from './db';
import type { D1Like } from './db/d1';

/**
 * The page with its kitchen's links when the path belongs to a kitchen or an order; every other HTML
 * page gets the default link preview. Not an HTML page: as it is.
 */
export async function withKitchenLinks(
  request: Request,
  env: { DB: D1Like },
  page: Response,
): Promise<Response> {
  if (request.method !== 'GET' || !page.headers.get('Content-Type')?.includes('text/html')) {
    return page;
  }
  const { origin, pathname } = new URL(request.url);
  const fallback = (): Response => {
    // Every page carries a link preview; ShaggyBobo's when it belongs to no kitchen (plan 047); seller pages also get the default seller app links (plan 048).
    const plain = new HTMLRewriter()
      .on('head', {
        element(head) {
          head.append(
            (isSellerPath(pathname) ? defaultSellerHeadHtml() : '') +
              linkPreviewHtml(defaultPreview(), origin, pathname),
            { html: true },
          );
        },
      })
      .transform(page);
    plain.headers.delete('ETag');
    plain.headers.set('Cache-Control', 'no-cache');
    return plain;
  };
  try {
    const repo = createD1Repository(env.DB, {
      now: () => new Date(),
      adminSetupKey: crypto.randomUUID(), // never used: this only reads
    });
    const found = await kitchenPageFor(repo, pathname, origin);
    if (found === null) return fallback();
    const { head: html, theme } = found;
    const rewritten = new HTMLRewriter()
      .on('head', {
        element(head) {
          head.append(html, { html: true });
        },
      })
      .on('html', {
        element(root) {
          if (theme !== undefined) root.setAttribute('data-brand', theme);
        },
      })
      .transform(page);
    // The head now depends on the kitchen or the session: the file's own validators and caching no longer fit.
    rewritten.headers.delete('ETag');
    rewritten.headers.set('Cache-Control', 'no-cache');
    return rewritten;
  } catch {
    return fallback();
  }
}
