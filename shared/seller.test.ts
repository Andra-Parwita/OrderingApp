import { describe, expect, it } from 'vitest';
import { DEFAULT_SELLER_SLUG, isValidSlug, parseSeller, RESERVED_SLUGS } from './seller';

describe('isValidSlug', () => {
  it.each(['onde-onde', 'dapur-demo', 'ab', 'a1', '42', 'kitchen-2-go', 'a'.repeat(40)])(
    'accepts %s',
    (slug) => {
      expect(isValidSlug(slug)).toBe(true);
    },
  );

  it.each([
    ['too short', 'a'],
    ['empty', ''],
    ['too long', 'a'.repeat(41)],
    ['uppercase', 'Onde-Onde'],
    ['a space', 'onde onde'],
    ['an underscore', 'onde_onde'],
    ['a slash', 'onde/onde'],
    ['a dot', 'onde.onde'],
    ['a leading hyphen', '-onde'],
    ['a trailing hyphen', 'onde-'],
    ['a double hyphen', 'onde--onde'],
    ['an accent', 'dapur-é'],
  ])('rejects %s', (_label, slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug(42)).toBe(false);
  });

  it('refuses every reserved word, and keeps the owner-ruled list', () => {
    expect(RESERVED_SLUGS).toEqual(
      expect.arrayContaining([
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
      ]),
    );
    for (const word of RESERVED_SLUGS) expect(isValidSlug(word)).toBe(false);
  });

  it('allows a reserved word inside a longer slug', () => {
    expect(isValidSlug('seller-one')).toBe(true);
    expect(isValidSlug('my-orders-2')).toBe(true);
  });

  it('accepts the default dev seller', () => {
    expect(isValidSlug(DEFAULT_SELLER_SLUG)).toBe(true);
  });
});

describe('parseSeller', () => {
  it('parses a seller and rejects a bad one', () => {
    expect(parseSeller({ id: 's1', slug: 'onde-onde', name: 'Onde Onde' })).toEqual({
      id: 's1',
      slug: 'onde-onde',
      name: 'Onde Onde',
    });
    expect(parseSeller({ id: 's1', slug: 'Admin', name: 'x' })).toBeNull();
    expect(parseSeller({ id: 's1', slug: 'api', name: 'x' })).toBeNull();
    expect(parseSeller({ slug: 'ok', name: 'x' })).toBeNull();
    expect(parseSeller(null)).toBeNull();
  });
});
