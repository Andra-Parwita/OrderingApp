// Pages from the static assets, with the kitchen's manifest and icon links added to the head (plan 011).
// Apart from api/ because HTMLRewriter exists only in the Worker runtime, not in the unit tests.
import {
  defaultPreview,
  defaultSellerHeadHtml,
  isSellerPath,
  linkPreviewHtml,
} from '../shared/kitchenHeadLinks';
import { SELLER_HELP_PATH } from '../shared/help';
import { parseOrderPath } from '../shared/orderPath';
import { kitchenPageFor } from './api/kitchenPage';
import { createD1Repository } from './db';
import type { D1Like } from './db/d1';
import { orderRedirect } from './redirects';

const readOnlyRepo = (env: { DB: D1Like }) =>
  createD1Repository(env.DB, {
    now: () => new Date(),
    adminSetupKey: crypto.randomUUID(), // never used: this only reads
  });

/**
 * The page with its kitchen's links when the path belongs to a kitchen or an order; every other HTML
 * page gets the default link preview. Not an HTML page: as it is.
 */
export async function withKitchenLinks(
  request: Request,
  env: { DB: D1Like },
  page: Response,
): Promise<Response> {
  // The seller Help page is public but not for search engines (D-095): the header on top of the page's own meta tag.
  if (new URL(request.url).pathname === SELLER_HELP_PATH) {
    const help = new Response(page.body, page);
    help.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return help;
  }
  // Old order links (`/o/<token>...`) and order links under the wrong kitchen go to the real one (plan 102, risk 1).
  if (request.method === 'GET' && parseOrderPath(new URL(request.url).pathname) !== null) {
    try {
      const redirect = await orderRedirect(readOnlyRepo(env), request.url);
      if (redirect !== null) return redirect;
    } catch {
      // fail-open: serve the page as before
    }
  }
  if (request.method !== 'GET' || !page.headers.get('Content-Type')?.includes('text/html')) {
    return page;
  }
  const { origin, pathname, search } = new URL(request.url);
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
    const repo = readOnlyRepo(env);
    const found = await kitchenPageFor(repo, pathname, origin, search);
    if (found === null) return fallback();
    const { head: html, theme, splash } = found;
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
      .on('#splash-name', {
        element(el) {
          if (splash) el.setInnerContent(splash.name); // text: HTMLRewriter escapes it
        },
      })
      .on('#splash-logo', {
        element(el) {
          if (!splash) return;
          if (splash.logo === null) {
            el.setAttribute('class', 'sp-logo sp-ini');
            el.setInnerContent(splash.initials);
          } else {
            el.setAttribute('class', 'sp-logo');
          }
        },
      })
      .on('#splash-img', {
        element(el) {
          if (splash?.logo) el.setAttribute('src', splash.logo);
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
