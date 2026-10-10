// One web app manifest and one default icon per kitchen (plan 004 stage 6, spec 6.4 and 6.5).
// The colours are the kitchen theme's light `fill`, `on` and `bg` (copied from
// src/theme/designTokens.ts; the worker cannot import src/).
import type { ThemeName } from './themes';

type ThemeColours = { fill: string; on: string; bg: string };

export const THEME_COLOURS: Record<ThemeName, ThemeColours> = {
  onde: { fill: '#2F6B36', on: '#FFFFFF', bg: '#F6F2E8' },
  bali: { fill: '#1D5C73', on: '#FFFFFF', bg: '#F1F4F4' },
  sumatra: { fill: '#8A2232', on: '#FFFFFF', bg: '#F7F0EE' },
  sunda: { fill: '#3A4C96', on: '#FFFFFF', bg: '#F2F2F7' },
  jawa: { fill: '#7A4A1E', on: '#FFFFFF', bg: '#F6F0E6' },
};

export const ICON_SIZES = [180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const manifestPath = (slug: string): string => `/k/${slug}/manifest.webmanifest`;
export const iconPath = (slug: string, size: IconSize, ext: 'png' | 'svg' = 'png'): string =>
  `/k/${slug}/icon-${String(size)}.${ext}`;

/** The home-screen icon for iOS: always answers with a PNG (the upload, or the shared default). */
export const appleTouchIconPath = (slug: string): string =>
  `/k/${encodeURIComponent(slug)}/apple-touch-icon.png`;

/** The seller app's home-screen name; a name, so the same in EN and ID. */
export const sellerAppName = (kitchenName: string): string => `${kitchenName} · Seller`;

/** The seller app's manifest: start and scope `/seller`, the same icons (plan 011 stage 4). */
export const sellerManifestPath = (slug: string): string =>
  `/k/${encodeURIComponent(slug)}/seller.webmanifest`;

/** The shared default icon (public/), served for kitchens without an uploaded one. */
export const DEFAULT_ICON_PATH = '/app-icon.png';

/** Up to two initials: the first letters of the first two words ("Onde Onde" gives "OO"). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The default icon: the initials in `on` over `fill`, filling the whole square (the phone rounds it).
 * The letters sit in the middle 56 % so the same file also works as a maskable icon.
 */
export function defaultIconSvg(name: string, theme: ThemeName): string {
  const { fill, on } = THEME_COLOURS[theme];
  const initials = initialsOf(name);
  const size = initials.length > 1 ? 200 : 260;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
    `<rect width="512" height="512" fill="${fill}"/>` +
    `<text x="256" y="256" fill="${on}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" ` +
    `font-size="${String(size)}" font-weight="700" text-anchor="middle" dominant-baseline="central">${escapeXml(initials)}</text>` +
    `</svg>`
  );
}

/**
 * The page to open from the home-screen icon: a same-origin path starting `/o/` (an order) or
 * `/<slug>` (the menu). Anything else, including `//host`, backslashes and other kitchens' paths,
 * falls back to `/<slug>`.
 */
export function safeStartUrl(start: string | null, slug: string): string {
  const fallback = `/${slug}`;
  if (start === null || start.length > 200 || !start.startsWith('/')) return fallback;
  if (start.startsWith('//') || start.includes('\\') || start.includes('..')) return fallback;
  if (/[^\x21-\x7e]/.test(start)) return fallback;
  const path = start.split(/[?#]/)[0] ?? '';
  const ok = path.startsWith('/o/') || path === fallback || path.startsWith(`${fallback}/`);
  return ok ? start : fallback;
}

export type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };

export type KitchenManifest = {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: 'standalone';
  background_color: string;
  theme_color: string;
  icons: Array<ManifestIcon>;
};

/**
 * `uploadedType` is the content type of the seller's small icon (served as PNG-named files at any
 * size); without one the icons are the shared default PNG (same URLs, so never SVG-only).
 */
export function buildManifest(input: {
  slug: string;
  name: string;
  theme: ThemeName;
  start: string | null;
  uploadedType?: string;
  /** The seller app's manifest: named "<kitchen> · Seller", starting and scoped at `/seller`. */
  seller?: boolean;
}): KitchenManifest {
  const { slug, theme, start, uploadedType, seller } = input;
  const name = seller === true ? sellerAppName(input.name) : input.name;
  const { bg } = THEME_COLOURS[theme];
  const type = uploadedType ?? 'image/png';
  const icons: Array<ManifestIcon> = [
    { src: iconPath(slug, 192), sizes: '192x192', type },
    { src: iconPath(slug, 512), sizes: '512x512', type },
    { src: iconPath(slug, 512), sizes: '512x512', type, purpose: 'maskable' },
  ];
  return {
    name,
    short_name: name,
    start_url: seller === true ? '/seller' : safeStartUrl(start, slug),
    scope: seller === true ? '/seller' : '/',
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons,
  };
}
