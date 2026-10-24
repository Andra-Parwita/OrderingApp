import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS, isValidSlug } from './seller';
import {
  ORDER_HOME_SOURCE,
  orderPath,
  orderStartPath,
  parseOrderPath,
  unresolvedOrderPath,
} from './orderPath';

describe('orderPath (plan 102 stage 4)', () => {
  it('writes the order under its kitchen, with a sub-page', () => {
    expect(orderPath('onde-onde', 'tok')).toBe('/onde-onde/o/tok');
    expect(orderPath('onde-onde', 'tok', '/placed')).toBe('/onde-onde/o/tok/placed');
    expect(orderPath('onde-onde', 'tok', '/edit/name')).toBe('/onde-onde/o/tok/edit/name');
  });

  it('encodes a token that is not url-safe', () => {
    expect(orderPath('onde-onde', 'a b/c')).toBe('/onde-onde/o/a%20b%2Fc');
    expect(parseOrderPath(orderPath('onde-onde', 'a b/c'))?.token).toBe('a b/c');
  });

  it('the home-screen start is the order path with ?source=homescreen', () => {
    expect(orderStartPath('onde-onde', 'tok')).toBe('/onde-onde/o/tok?source=homescreen');
    expect(ORDER_HOME_SOURCE).toBe('homescreen');
  });

  it('reads both shapes, with sub-pages, query and hash', () => {
    expect(parseOrderPath('/onde-onde/o/tok')).toEqual({
      slug: 'onde-onde',
      token: 'tok',
      sub: '',
    });
    expect(parseOrderPath('/onde-onde/o/tok/qr?x=1#h')).toEqual({
      slug: 'onde-onde',
      token: 'tok',
      sub: '/qr',
    });
    expect(parseOrderPath('/o/tok')).toEqual({ slug: null, token: 'tok', sub: '' });
    expect(parseOrderPath('/o/tok/edit/name')).toEqual({
      slug: null,
      token: 'tok',
      sub: '/edit/name',
    });
    expect(parseOrderPath('/o/tok/')).toEqual({ slug: null, token: 'tok', sub: '' });
    expect(parseOrderPath('/o/tok?source=homescreen')?.token).toBe('tok');
  });

  it('ignores everything that is not an order address', () => {
    for (const other of [
      '/',
      '/o',
      '/o/',
      '/onde-onde',
      '/onde-onde/o',
      '/onde-onde/o/',
      '/onde-onde/dishes',
      '/my-orders',
      '/my-orders/o/tok', // reserved word is not a kitchen
      '/settings/o/tok',
      '/seller/o/tok',
      '//evil.test/o/tok',
      'o/tok',
      'https://x.test/o/tok',
      '',
    ]) {
      expect(parseOrderPath(other), other).toBeNull();
    }
    expect(parseOrderPath(undefined)).toBeNull();
    expect(parseOrderPath(42)).toBeNull();
  });

  it('keeps o, my-orders and settings unusable as kitchen slugs', () => {
    for (const word of ['o', 'my-orders', 'settings']) {
      expect(RESERVED_SLUGS).toContain(word);
      expect(isValidSlug(word)).toBe(false);
    }
  });

  it('the one old-style builder (a saved entry without a kitchen) still parses', () => {
    expect(unresolvedOrderPath('tok')).toBe('/o/tok');
    expect(parseOrderPath(unresolvedOrderPath('tok'))).toEqual({
      slug: null,
      token: 'tok',
      sub: '',
    });
  });
});
