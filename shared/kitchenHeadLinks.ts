// The kitchen's manifest and home-screen icon links, as HTML for the page head (plan 011). The Worker
// (production) and Vite (dev) add them to the page a phone first receives; React keeps them right
// after navigation (src/components/install/manifestLinks.ts) with the same hrefs.
import {
  DEFAULT_SELLER_ICON_PATH,
  DEFAULT_SELLER_MANIFEST_PATH,
  appleTouchIconPath,
  sellerAppName,
  sellerManifestPath,
} from './kitchenManifest';
import { isValidSlug } from './seller';
import { THEME_BAR_COLOUR } from './themeColours';
import type { ThemeName } from './themes';

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

/** The seller app's head links before any kitchen is known (sign-in, first setup; plan 048). */
export const defaultSellerHeadHtml = (): string =>
  `<link rel="manifest" href="${DEFAULT_SELLER_MANIFEST_PATH}">` +
  `<link rel="apple-touch-icon" href="${DEFAULT_SELLER_ICON_PATH}">` +
  `<meta name="apple-mobile-web-app-title" content="Seller">`;

/** A seller page path: `/seller` and everything under it. */
export const isSellerPath = (pathname: string): boolean =>
  pathname === '/seller' || pathname.startsWith('/seller/');

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

/** The kitchen's page background in light mode: the browser bar colour until React sets the real one (plan 024). */
export const themeColour = (theme: ThemeName): string => THEME_BAR_COLOUR[theme];

/** `<meta name="theme-color">` for a kitchen or order page (plan 024). */
export const themeColourHtml = (theme: ThemeName): string =>
  `<meta name="theme-color" content="${escapeAttr(themeColour(theme))}">`;

/** The ShaggyBobo link-preview picture (plan 047): a small square, so WhatsApp shows a thumbnail. */
export const DEFAULT_OG_IMAGE = { path: '/brand/og-shaggybobo.png', width: 512, height: 512 };
export const DEFAULT_OG_TITLE = "ShaggyBobo's Order";
const DEFAULT_OG_DESCRIPTION =
  'Weekly home-cooked menu, order by link · Menu masakan rumahan mingguan, pesan lewat tautan';

export type LinkPreview = {
  title: string;
  description: string;
  /** Site path or absolute URL of the picture. */
  image: string;
  width: number;
  height: number;
};

const defaultImage = () => ({
  image: DEFAULT_OG_IMAGE.path,
  width: DEFAULT_OG_IMAGE.width,
  height: DEFAULT_OG_IMAGE.height,
});

/** The preview of a kitchen or order page: its name and its app icon (square), else ShaggyBobo's picture. */
export function kitchenPreview(name: string, images?: { railIcon?: string }): LinkPreview {
  const description = `Order from ${name} · Pesan dari ${name}`;
  if (images?.railIcon) {
    return { title: name, description, image: images.railIcon, width: 512, height: 512 };
  }
  return { title: name, description, ...defaultImage() };
}

/** The preview of every other page. */
export const defaultPreview = (): LinkPreview => ({
  title: DEFAULT_OG_TITLE,
  description: DEFAULT_OG_DESCRIPTION,
  ...defaultImage(),
});

const absolute = (origin: string, ref: string): string =>
  /^https?:\/\//i.test(ref) ? ref : origin + (ref.startsWith('/') ? ref : `/${ref}`);

/** Open Graph and Twitter tags for the head (plan 047). `origin` is the request's, e.g. https://order.shaggybobo.app. */
export function linkPreviewHtml(preview: LinkPreview, origin: string, pathname: string): string {
  const meta = (key: string, value: string | number, attr = 'property'): string =>
    `<meta ${attr}="${key}" content="${escapeAttr(String(value))}">`;
  return (
    meta('og:type', 'website') +
    meta('og:site_name', DEFAULT_OG_TITLE) +
    meta('og:title', preview.title) +
    meta('og:description', preview.description) +
    meta('og:image', absolute(origin, preview.image)) +
    meta('og:image:width', preview.width) +
    meta('og:image:height', preview.height) +
    meta('og:url', origin + pathname) +
    meta('twitter:card', 'summary', 'name')
  );
}
