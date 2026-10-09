import { useEffect } from 'react';
import { isValidSlug } from '../../../shared/seller';

// The per-kitchen web app manifest and the iPhone home-screen icon (plan 004 stage 7, spec 6.4).
// "Add to Home Screen" reads the page's links at that moment, so they are set when the page loads:
// the manifest's `start_url` is the page the customer is on (their order, for the order flow).

export type ManifestTarget = Readonly<{ slug: string; start: string }>;

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

export function manifestHref({ slug, start }: ManifestTarget): string {
  return `/k/${encodeURIComponent(slug)}/manifest.webmanifest?start=${encodeURIComponent(start)}`;
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
 * Points the page at the kitchen's manifest. `apple-touch-icon` is linked only when the kitchen
 * uploaded a small icon: the default icon is an SVG, which iOS does not take (it would show a
 * screenshot of the page instead, so no link is better than a wrong one).
 */
export function setManifestLinks(target: ManifestTarget | null, hasUploadedIcon: boolean): void {
  setLink('manifest', target ? manifestHref(target) : null);
  setLink(
    'apple-touch-icon',
    target && hasUploadedIcon ? `/k/${encodeURIComponent(target.slug)}/icon-180.png` : null,
  );
}

/** Keeps the manifest links right for the page on show. */
export function useManifestLinks(target: ManifestTarget | null, hasUploadedIcon: boolean): void {
  const slug = target?.slug;
  const start = target?.start;
  useEffect(() => {
    setManifestLinks(
      slug !== undefined && start !== undefined ? { slug, start } : null,
      hasUploadedIcon,
    );
  }, [slug, start, hasUploadedIcon]);
}
