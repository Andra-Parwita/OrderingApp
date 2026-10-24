import { useEffect } from 'react';
import { manifestHref as kitchenManifestHref } from '../../../shared/kitchenHeadLinks';
import {
  DEFAULT_SELLER_ICON_PATH,
  DEFAULT_SELLER_MANIFEST_PATH,
  appleTouchIconPath,
  sellerManifestPath,
} from '../../../shared/kitchenManifest';
import { ORDER_HOME_SOURCE, orderStartPath, parseOrderPath } from '../../../shared/orderPath';
import { isValidSlug } from '../../../shared/seller';

// The per-kitchen web app manifest and the iPhone home-screen icon (plan 004 stage 7, spec 6.4).
// "Add to Home Screen" reads the page's links at that moment, so they are set when the page loads:
// the manifest's `start_url` is the page the customer is on (their order, for the order flow).

/** `seller`: the seller app's own manifest (start and scope `/seller`), not the customer one. */
export type ManifestTarget = Readonly<{ slug: string; start: string; seller?: true }>;

/** The order link the installed app opens first (the first-open code in OrderScreen reads it). */
export const HOME_SCREEN_SOURCE = ORDER_HOME_SOURCE;

/**
 * The manifest for this page, or null when no kitchen is known yet. `orderSlug` is the seller of the
 * order on an order page. My orders and Settings belong to no kitchen, so they link none (plan 102:
 * the app is installed from a kitchen's own page, never from the kitchen visited last); `lastSlug` is
 * accepted but no longer used.
 */
export function manifestTarget(
  pathname: string,
  known: Readonly<{ orderSlug?: string | undefined; lastSlug?: string | null | undefined }> = {},
): ManifestTarget | null {
  const order = parseOrderPath(pathname);
  if (order) {
    // The order page lives under its kitchen (plan 102): the loaded order's seller, else the path's own slug.
    const slug = known.orderSlug ?? order.slug;
    return slug === null ? null : { slug, start: orderStartPath(slug, order.token) };
  }
  const first = pathname.split('/').filter(Boolean)[0];
  if (first === 'my-orders' || first === 'settings') return null;
  // Any other kitchen page (dishes, basket...) installs to the kitchen's menu, not mid-checkout.
  return isValidSlug(first) ? { slug: first, start: `/${first}` } : null;
}

/** The seller app's manifest for the signed-in kitchen; null when there is no kitchen (admin, signed out). */
export function sellerManifestTarget(slug: string | undefined): ManifestTarget | null {
  return isValidSlug(slug) ? { slug, start: '/seller', seller: true } : null;
}

/**
 * The kitchen a seller link names (`?k=<slug>`, plan 101), or undefined for none or an invalid one.
 * Only a named kitchen switches the seller page to that kitchen's manifest; no `k` keeps the old app's.
 */
export function sellerKitchenOfSearch(search: string): string | undefined {
  const k = new URLSearchParams(search).get('k');
  return isValidSlug(k) ? k : undefined;
}

export function manifestHref({ slug, start, seller }: ManifestTarget): string {
  return seller ? sellerManifestPath(slug) : kitchenManifestHref(slug, start);
}

function setLink(rel: string, href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === null) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (!existing) document.head.append(link);
}

/**
 * Points the page at the kitchen's manifest and icon. The icon address always answers with a PNG
 * (the upload, or the shared default), so `apple-touch-icon` is always linked (plan 011).
 */
export function setManifestLinks(target: ManifestTarget | null, sellerFallback = false): void {
  // Seller pages without a kitchen keep ShaggyBobo's seller app links (plan 048).
  const none = sellerFallback
    ? { manifest: DEFAULT_SELLER_MANIFEST_PATH, icon: DEFAULT_SELLER_ICON_PATH }
    : { manifest: null, icon: null };
  setLink('manifest', target ? manifestHref(target) : none.manifest);
  setLink('apple-touch-icon', target ? appleTouchIconPath(target.slug) : none.icon);
}

/** Keeps the manifest links right for the page on show. */
export function useManifestLinks(target: ManifestTarget | null, sellerFallback = false): void {
  const slug = target?.slug;
  const start = target?.start;
  const seller = target?.seller;
  useEffect(() => {
    setManifestLinks(
      slug !== undefined && start !== undefined
        ? { slug, start, ...(seller ? { seller } : {}) }
        : null,
      sellerFallback,
    );
  }, [slug, start, seller, sellerFallback]);
}
