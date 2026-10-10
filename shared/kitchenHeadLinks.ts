// The kitchen's manifest and home-screen icon links, as HTML for the page head (plan 011). The Worker
// (production) and Vite (dev) add them to the page a phone first receives; React keeps them right
// after navigation (src/components/install/manifestLinks.ts) with the same hrefs.
import { appleTouchIconPath, sellerAppName, sellerManifestPath } from './kitchenManifest';
import { isValidSlug } from './seller';

export const manifestHref = (slug: string, start: string = `/${slug}`): string =>
  `/k/${encodeURIComponent(slug)}/manifest.webmanifest?start=${encodeURIComponent(start)}`;

/** The seller app's head links (plan 011 stage 4): its own manifest, the kitchen's icon. */
export function sellerHeadHtml(slug: string, name?: string): string {
  return (
    `<link rel="manifest" href="${escapeAttr(sellerManifestPath(slug))}">` +
    `<link rel="apple-touch-icon" href="${escapeAttr(appleTouchIconPath(slug))}">` +
    (name === undefined
      ? ''
      : `<meta name="apple-mobile-web-app-title" content="${escapeAttr(sellerAppName(name))}">`)
  );
}

export type KitchenPageTarget = { slug: string } | { token: string };

/** What a page path belongs to: `/o/<token>` an order, `/<slug>[/...]` a kitchen, else nothing (reserved words included). */
export function kitchenPageTarget(pathname: string): KitchenPageTarget | null {
  const [first, second] = pathname.split('/').filter(Boolean);
  if (first === 'o') return second === undefined ? null : { token: second };
  return isValidSlug(first) ? { slug: first } : null;
}

const escapeAttr = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The links for the head. `name` (the kitchen name) is left out when unknown, as in dev. */
export function kitchenHeadHtml(slug: string, name?: string, start?: string): string {
  return (
    `<link rel="manifest" href="${escapeAttr(manifestHref(slug, start))}">` +
    `<link rel="apple-touch-icon" href="${escapeAttr(appleTouchIconPath(slug))}">` +
    (name === undefined
      ? ''
      : `<meta name="apple-mobile-web-app-title" content="${escapeAttr(name)}">`)
  );
}
