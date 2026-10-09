import { RESERVED_SLUGS, SLUG_MAX, SLUG_MIN } from '../../../shared/seller';

export type SlugProblem = 'chars' | 'short' | 'long' | 'reserved' | 'taken';

const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Why a seller link cannot be used, or null when it can (an empty link is not an error yet). */
export function slugProblem(slug: string, taken: ReadonlyArray<string>): SlugProblem | null {
  if (slug === '') return null;
  if (slug.length > SLUG_MAX) return 'long';
  if (!SHAPE.test(slug)) return 'chars';
  if (slug.length < SLUG_MIN) return 'short';
  if (RESERVED_SLUGS.includes(slug)) return 'reserved';
  return taken.includes(slug) ? 'taken' : null;
}
