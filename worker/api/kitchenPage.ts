// The kitchen's manifest and icon links in the HTML itself (plan 011), so a phone adding the page to
// the home screen finds them without waiting for React.
import {
  bannerPreloadHtml,
  defaultPreview,
  defaultSellerHeadHtml,
  isSellerPath,
  kitchenHeadHtml,
  kitchenPageTitle,
  kitchenPreview,
  sellerHeadHtml,
  linkPreviewHtml,
  kitchenPageTarget,
  themeColourHtml,
} from '../../shared/kitchenHeadLinks';
import { iconPath, initialsOf } from '../../shared/kitchenManifest';
import { orderStartPath } from '../../shared/orderPath';
import { isValidSlug } from '../../shared/seller';
import { DEFAULT_THEME, type ThemeName } from '../../shared/themes';
import type { Repository } from '../repo/Repository';
import { iconTypeOfRef } from './kitchenRoutes';

/** What the Worker adds to a page: head HTML and, on kitchen and order pages, the kitchen's theme (plan 024). */
export interface KitchenPage {
  head: string;
  /** The page's `<title>`: the kitchen's name, "<Kitchen> · Order" on an order page. Absent on other pages. */
  title?: string;
  theme?: ThemeName;
  /** The loading splash's kitchen name and logo (plan 115): the uploaded icon, else the initials. */
  splash?: { name: string; logo: string | null; initials: string };
}

function splashFor(
  slug: string,
  name: string,
  railIcon: string | undefined,
): NonNullable<KitchenPage['splash']> {
  const uploaded = iconTypeOfRef(railIcon) !== undefined;
  return {
    name,
    logo: uploaded ? iconPath(encodeURIComponent(slug), 192) : null,
    initials: initialsOf(name),
  };
}

/**
 * The seller head of the kitchen a seller link names (`/seller?k=<slug>`, plan 101), or null for no `k`,
 * an invalid or unknown one, or any lookup error: the caller then keeps the default seller head.
 */
async function namedSellerHead(store: Repository, search: string): Promise<string | null> {
  try {
    const k = new URLSearchParams(search).get('k');
    if (!isValidSlug(k)) return null;
    const repo = await store.sellerBySlug(k);
    return repo ? sellerHeadHtml(repo.seller.slug, repo.seller.name) : null;
  } catch {
    return null;
  }
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
  search = '',
): Promise<KitchenPage | null> {
  // Every seller page gets ShaggyBobo's seller app manifest (plan 048), because the URL has no kitchen;
  // except a link that names one (`?k=<slug>`, plan 101), which gets that kitchen's seller app links.
  if (isSellerPath(pathname)) {
    const named = await namedSellerHead(store, search);
    return {
      head:
        (named ?? defaultSellerHeadHtml()) + linkPreviewHtml(defaultPreview(), origin, pathname),
    };
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
        bannerPreloadHtml(menu.kitchen) +
        linkPreviewHtml(kitchenPreview(name, menu.kitchen.images), origin, pathname),
      title: kitchenPageTitle(name),
      theme,
      splash: splashFor(slug, name, menu.kitchen.images?.railIcon),
    };
  }
  const found = await store.lookupByToken(target.token);
  if (!found) return null;
  const { slug, name } = found.sellerRepo.seller;
  const menu = await found.sellerRepo.getMenu();
  const theme = menu.theme ?? DEFAULT_THEME;
  // Same start page as the one React sets (manifestTarget in src/components/install/manifestLinks.ts): the order under its own kitchen.
  return {
    head:
      kitchenHeadHtml(slug, name, orderStartPath(slug, target.token)) +
      themeColourHtml(theme) +
      bannerPreloadHtml(menu.kitchen) +
      linkPreviewHtml(kitchenPreview(name, menu.kitchen.images), origin, pathname),
    title: kitchenPageTitle(name, 'Order'),
    theme,
    splash: splashFor(slug, name, menu.kitchen.images?.railIcon),
  };
}

/** The head HTML alone (see `kitchenPageFor`). */
export async function kitchenHeadFor(store: Repository, pathname: string): Promise<string | null> {
  return (await kitchenPageFor(store, pathname))?.head ?? null;
}
