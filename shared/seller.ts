import type { Seller } from './domain';
import { isRecord } from './parse';

/** The seller the dev mock uses when a request names none; phase 4 replaces this with the session. */
export const DEFAULT_SELLER_SLUG = 'onde-onde';

export const SLUG_MIN = 2;
export const SLUG_MAX = 40;

/** Top-level paths a seller's slug must never shadow (D-037), plus the app's own routes. */
export const RESERVED_SLUGS: ReadonlyArray<string> = [
  'seller',
  'admin',
  'o',
  'api',
  'my-orders',
  'settings',
  'samples',
  'basket',
  'assets',
  's',
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lowercase letters, digits and single hyphens (not at either end), 2 to 40 characters, and not
 * a reserved word. Case is not folded: "Onde-Onde" is invalid.
 */
export function isValidSlug(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    slug.length >= SLUG_MIN &&
    slug.length <= SLUG_MAX &&
    SLUG.test(slug) &&
    !RESERVED_SLUGS.includes(slug)
  );
}

/** Response check for a seller. */
export function parseSeller(input: unknown): Seller | null {
  if (!isRecord(input)) return null;
  const { id, slug, name } = input;
  if (typeof id !== 'string' || id === '' || typeof name !== 'string') return null;
  return isValidSlug(slug) ? { id, slug, name } : null;
}
