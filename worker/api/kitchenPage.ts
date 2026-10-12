// The kitchen's manifest and icon links in the HTML itself (plan 011), so a phone adding the page to
// the home screen finds them without waiting for React.
import {
  defaultPreview,
  defaultSellerHeadHtml,
  isSellerPath,
  kitchenHeadHtml,
  kitchenPreview,
  linkPreviewHtml,
  kitchenPageTarget,
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
 * unknown slug or token). Seller pages (`/seller`, `/seller/*`) get the default seller app links.
 * Kitchen and order pages also carry the kitchen's current theme, read from the DB on every call.
 */
export async function kitchenPageFor(
  store: Repository,
  pathname: string,
  origin = '',
): Promise<KitchenPage | null> {
  // Every seller page, signed in or not, gets ShaggyBobo's seller app manifest (plan 048): the URL has
  // no kitchen, and the kitchen's own seller manifest was not installable on Android Chrome.
  if (isSellerPath(pathname)) {
    return { head: defaultSellerHeadHtml() + linkPreviewHtml(defaultPreview(), origin, pathname) };
  }
  const target = kitchenPageTarget(pathname);
  if (!target) return null;
  if ('slug' in target) {
    const repo = await store.sellerBySlug(target.slug);
    if (!repo) return null;
    const { slug, name } = repo.seller;
    const menu = await repo.getMenu();
    const theme = menu.theme ?? DEFAULT_THEME;
    return {
      head:
        kitchenHeadHtml(slug, name) +
        themeColourHtml(theme) +
        linkPreviewHtml(kitchenPreview(name, menu.kitchen.images), origin, pathname),
      theme,
    };
  }
  const found = await store.lookupByToken(target.token);
  if (!found) return null;
  const { slug, name } = found.sellerRepo.seller;
  const menu = await found.sellerRepo.getMenu();
  const theme = menu.theme ?? DEFAULT_THEME;
  // Same start page as the one React sets (HOME_SCREEN_SOURCE in src/components/install/manifestLinks.ts).
  return {
    head:
      kitchenHeadHtml(slug, name, `/o/${target.token}?source=homescreen`) +
      themeColourHtml(theme) +
      linkPreviewHtml(kitchenPreview(name, menu.kitchen.images), origin, pathname),
    theme,
  };
}

/** The head HTML alone (see `kitchenPageFor`). */
export async function kitchenHeadFor(store: Repository, pathname: string): Promise<string | null> {
  return (await kitchenPageFor(store, pathname))?.head ?? null;
}
