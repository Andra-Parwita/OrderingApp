import { beforeEach, describe, expect, it } from 'vitest';
import {
  manifestHref,
  manifestTarget,
  sellerKitchenOfSearch,
  sellerManifestTarget,
  setManifestLinks,
} from './manifestLinks';

const link = (rel: string) => document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

beforeEach(() => {
  document.head
    .querySelectorAll('link[rel="manifest"], link[rel="apple-touch-icon"]')
    .forEach((el) => {
      el.remove();
    });
});

describe('manifestTarget', () => {
  it('a kitchen page starts the app at the kitchen, whichever of its pages is open', () => {
    expect(manifestTarget('/onde-onde')).toEqual({ slug: 'onde-onde', start: '/onde-onde' });
    expect(manifestTarget('/onde-onde/basket/name')).toEqual({
      slug: 'onde-onde',
      start: '/onde-onde',
    });
  });

  it("an order page starts at that order with the home-screen source, for the order's kitchen", () => {
    const start = '/dapur-bu-rina/o/tok123?source=homescreen';
    // the old address, once the order's kitchen is known
    expect(manifestTarget('/o/tok123', { orderSlug: 'dapur-bu-rina' })).toEqual({
      slug: 'dapur-bu-rina',
      start,
    });
    expect(manifestTarget('/o/tok123/qr', { orderSlug: 'dapur-bu-rina' })?.start).toBe(start);
    // under the kitchen (plan 102): the address already names it
    expect(manifestTarget('/dapur-bu-rina/o/tok123')).toEqual({ slug: 'dapur-bu-rina', start });
    expect(manifestTarget('/dapur-bu-rina/o/tok123/edit/name')?.start).toBe(start);
    // the loaded order's seller wins over a wrong slug in the address
    expect(manifestTarget('/onde-onde/o/tok123', { orderSlug: 'dapur-bu-rina' })).toEqual({
      slug: 'dapur-bu-rina',
      start,
    });
  });

  it('an old-style order page waits for its kitchen', () => {
    expect(manifestTarget('/o/tok123')).toBeNull();
  });

  it('My orders and Settings link no kitchen, not even the last one visited (plan 102)', () => {
    expect(manifestTarget('/my-orders', { lastSlug: 'onde-onde' })).toBeNull();
    expect(manifestTarget('/settings', { lastSlug: 'onde-onde' })).toBeNull();
    expect(manifestTarget('/settings', { lastSlug: null })).toBeNull();
  });

  it('the home page and reserved words have no kitchen', () => {
    expect(manifestTarget('/')).toBeNull();
    expect(manifestTarget('/seller/orders')).toBeNull();
  });
});

describe('sellerKitchenOfSearch', () => {
  it('reads a valid k only', () => {
    expect(sellerKitchenOfSearch('?k=onde-onde')).toBe('onde-onde');
    expect(sellerKitchenOfSearch('')).toBeUndefined();
    expect(sellerKitchenOfSearch('?k=')).toBeUndefined();
    expect(sellerKitchenOfSearch('?k=A%20B')).toBeUndefined();
    expect(sellerKitchenOfSearch('?x=onde-onde')).toBeUndefined();
  });
});

describe('setManifestLinks', () => {
  it('sets the manifest link with the start page encoded', () => {
    setManifestLinks({ slug: 'onde-onde', start: '/onde-onde/o/tok?source=homescreen' });
    expect(link('manifest')?.getAttribute('href')).toBe(
      '/k/onde-onde/manifest.webmanifest?start=%2Fonde-onde%2Fo%2Ftok%3Fsource%3Dhomescreen',
    );
  });

  it('always links apple-touch-icon to the kitchen address (a PNG even without an upload)', () => {
    setManifestLinks({ slug: 'onde-onde', start: '/onde-onde' });
    expect(link('apple-touch-icon')?.getAttribute('href')).toBe(
      '/k/onde-onde/apple-touch-icon.png',
    );
  });

  it('the seller app links its own manifest and the same icon', () => {
    expect(sellerManifestTarget(undefined)).toBeNull();
    const target = sellerManifestTarget('onde-onde');
    expect(target).toEqual({ slug: 'onde-onde', start: '/seller', seller: true });
    setManifestLinks(target);
    expect(link('manifest')?.getAttribute('href')).toBe('/k/onde-onde/seller.webmanifest');
    expect(link('apple-touch-icon')?.getAttribute('href')).toBe(
      '/k/onde-onde/apple-touch-icon.png',
    );
    // no kitchen: the old seller app's links stay
    setManifestLinks(null, true);
    expect(link('manifest')?.getAttribute('href')).toBe('/seller.webmanifest');
  });

  it('updates the one link instead of adding another, and removes both for no kitchen', () => {
    setManifestLinks({ slug: 'a-kitchen', start: '/a-kitchen' });
    setManifestLinks({ slug: 'b-kitchen', start: '/b-kitchen' });
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(link('manifest')?.getAttribute('href')).toBe(
      manifestHref({ slug: 'b-kitchen', start: '/b-kitchen' }),
    );
    setManifestLinks(null);
    expect(link('manifest')).toBeNull();
    expect(link('apple-touch-icon')).toBeNull();
  });
});
