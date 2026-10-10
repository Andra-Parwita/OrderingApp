import { useEffect } from 'react';
import { manifestHref as kitchenManifestHref } from '../../../shared/kitchenHeadLinks';
import { appleTouchIconPath, sellerManifestPath } from '../../../shared/kitchenManifest';
import { isValidSlug } from '../../../shared/seller';

// The per-kitchen web app manifest and the iPhone home-screen icon (plan 004 stage 7, spec 6.4).
// "Add to Home Screen" reads the page's links at that moment, so they are set when the page loads:
// the manifest's `start_url` is the page the customer is on (their order, for the order flow).

/** `seller`: the seller app's own manifest (start and scope `/seller`), not the customer one. */
export type ManifestTarget = Readonly<{ slug: string; start: string; seller?: true }>;

/** The order link the installed app opens first (the first-open code in OrderScreen reads it). */
export const HOME_SCREEN_SOURCE = 'homescreen';

/**
 * The manifest for this page, or null when no kitchen is known yet. `orderSlug` is the seller of the
 * order on an order page; `lastSlug` is the kitchen this phone visited last (for My orders and
 * Settings, which belong to no kitchen of their own).
 */
export function manifestTarget(
  pathname: string,
  known: Readonly<{ orderSlug?: string | undefined; lastSlug?: string | null | undefined }> = {},
): ManifestTarget | null {
  const parts = pathname.split('/').filter(Boolean);
  const first = parts[0];
  if (first === 'o' && parts[1] !== undefined) {
    return known.orderSlug === undefined
      ? null
      : { slug: known.orderSlug, start: `/o/${parts[1]}?source=${HOME_SCREEN_SOURCE}` };
  }
  if (first === 'my-orders' || first === 'settings') {
    return known.lastSlug ? { slug: known.lastSlug, start: `/${first}` } : null;
  }
  // Any other kitchen page (dishes, basket...) installs to the kitchen's menu, not mid-checkout.
  return isValidSlug(first) ? { slug: first, start: `/${first}` } : null;
}

/** The seller app's manifest for the signed-in kitchen; null when there is no kitchen (admin, signed out). */
export function sellerManifestTarget(slug: string | undefined): ManifestTarget | null {
  return isValidSlug(slug) ? { slug, start: '/seller', seller: true } : null;
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
export function setManifestLinks(target: ManifestTarget | null): void {
  setLink('manifest', target ? manifestHref(target) : null);
  setLink('apple-touch-icon', target ? appleTouchIconPath(target.slug) : null);
}

/** Keeps the manifest links right for the page on show. */
export function useManifestLinks(target: ManifestTarget | null): void {
  const slug = target?.slug;
  const start = target?.start;
  const seller = target?.seller;
  useEffect(() => {
    setManifestLinks(
      slug !== undefined && start !== undefined
        ? { slug, start, ...(seller ? { seller } : {}) }
        : null,
    );
  }, [slug, start, seller]);
}
