// The kitchen's manifest and icon links in the HTML itself (plan 011), so a phone adding the page to
// the home screen finds them without waiting for React.
import {
  kitchenHeadHtml,
  kitchenPageTarget,
  sellerHeadHtml,
  themeColourHtml,
} from '../../shared/kitchenHeadLinks';
import { DEFAULT_THEME, type ThemeName } from '../../shared/themes';
import type { Repository } from '../repo/Repository';

/** What the Worker adds to a page: head HTML and, on kitchen and order pages, the kitchen's theme (plan 024). */
export interface KitchenPage {
  head: string;
  theme?: ThemeName;
}

/**
 * The head HTML for this page path, or null when it belongs to no known kitchen (reserved words,
 * unknown slug or token). Seller pages (`/seller`, `/seller/*`) have no slug in the URL: the kitchen
 * is the one of the signed-in seller's session (`sessionToken`); no session, no links.
 * Kitchen and order pages also carry the kitchen's current theme, read from the DB on every call.
 */
export async function kitchenPageFor(
  store: Repository,
  pathname: string,
  sessionToken?: string,
): Promise<KitchenPage | null> {
  if (pathname === '/seller' || pathname.startsWith('/seller/')) {
    const caller = await store.auth.resolve(sessionToken);
    if (!caller?.sellerId || caller.setup) return null;
    const seller = (await store.sellerById(caller.sellerId))?.seller;
    return seller ? { head: sellerHeadHtml(seller.slug, seller.name) } : null;
  }
  const target = kitchenPageTarget(pathname);
  if (!target) return null;
  if ('slug' in target) {
    const repo = await store.sellerBySlug(target.slug);
    if (!repo) return null;
    const { slug, name } = repo.seller;
    const theme = (await repo.getMenu()).theme ?? DEFAULT_THEME;
    return { head: kitchenHeadHtml(slug, name) + themeColourHtml(theme), theme };
  }
  const found = await store.lookupByToken(target.token);
  if (!found) return null;
  const { slug, name } = found.sellerRepo.seller;
  const theme = (await found.sellerRepo.getMenu()).theme ?? DEFAULT_THEME;
  // Same start page as the one React sets (HOME_SCREEN_SOURCE in src/components/install/manifestLinks.ts).
  return {
    head:
      kitchenHeadHtml(slug, name, `/o/${target.token}?source=homescreen`) + themeColourHtml(theme),
    theme,
  };
}

/** The head HTML alone (see `kitchenPageFor`). */
export async function kitchenHeadFor(
  store: Repository,
  pathname: string,
  sessionToken?: string,
): Promise<string | null> {
  return (await kitchenPageFor(store, pathname, sessionToken))?.head ?? null;
}
