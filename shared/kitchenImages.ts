import type { Kitchen, KitchenImages, Language } from './domain';

/** The phone banner, else the desktop banner (shown cropped), else nothing (D-035). */
export function phoneBannerSrc(images: KitchenImages | undefined): string | undefined {
  return images?.phoneBanner ?? images?.desktopBanner;
}

/** Alt text in the given language; "<kitchen name> banner" until the seller writes one. */
export function bannerAlt(kitchen: Pick<Kitchen, 'name' | 'images'>, lang: Language): string {
  return kitchen.images?.alt?.[lang] || `${kitchen.name} banner`;
}

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

/** A colour written as "#rrggbb". */
export function isHexColour(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOUR.test(value);
}
