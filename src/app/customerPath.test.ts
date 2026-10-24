import { describe, expect, it } from 'vitest';
import { customerArea } from './customerPath';
import { activeTab, hasTabBar, isRootPage, tabHref } from './CustomerShell';

describe('customer addresses by kitchen (plan 102 stage 4)', () => {
  it('reads the kitchen from the path', () => {
    expect(customerArea('/onde-onde/o/tok/qr')).toEqual({
      kind: 'order',
      slug: 'onde-onde',
      token: 'tok',
      sub: ['qr'],
    });
    expect(customerArea('/o/tok')).toMatchObject({ kind: 'order', slug: null, token: 'tok' });
    expect(customerArea('/onde-onde/my-orders')).toMatchObject({
      kind: 'orders',
      slug: 'onde-onde',
    });
    expect(customerArea('/onde-onde/settings/start-fresh')).toMatchObject({
      kind: 'settings',
      slug: 'onde-onde',
      sub: ['start-fresh'],
    });
    expect(customerArea('/my-orders')).toMatchObject({ kind: 'orders', slug: null });
    expect(customerArea('/settings')).toMatchObject({ kind: 'settings', slug: null });
    expect(customerArea('/onde-onde/basket/name')).toMatchObject({
      kind: 'kitchen',
      slug: 'onde-onde',
      sub: ['basket', 'name'],
    });
    expect(customerArea('/')).toMatchObject({ kind: 'other', slug: null });
  });

  it('activeTab follows the page, whatever the kitchen in the address', () => {
    for (const slug of ['onde-onde', 'dellavee']) {
      expect(activeTab(`/${slug}`)).toBe('menu');
      expect(activeTab(`/${slug}/basket`)).toBe('menu');
      expect(activeTab(`/${slug}/my-orders`)).toBe('orders');
      expect(activeTab(`/${slug}/o/tok`)).toBe('orders');
      expect(activeTab(`/${slug}/o/tok/placed`)).toBe('orders');
      expect(activeTab(`/${slug}/o/tok/edit`)).toBe('orders');
      expect(activeTab(`/${slug}/settings`)).toBe('settings');
      expect(activeTab(`/${slug}/settings/start-fresh`)).toBe('settings');
    }
    expect(activeTab('/my-orders')).toBe('orders');
    expect(activeTab('/o/tok')).toBe('orders');
    expect(activeTab('/settings')).toBe('settings');
  });

  it('hasTabBar hides the bar on checkout, edit and QR pages under the kitchen too', () => {
    expect(hasTabBar('/onde-onde/o/tok/edit')).toBe(false);
    expect(hasTabBar('/onde-onde/o/tok/edit/name')).toBe(false);
    expect(hasTabBar('/onde-onde/o/tok/qr')).toBe(false);
    expect(hasTabBar('/onde-onde/o/tok/qr/')).toBe(false);
    expect(hasTabBar('/onde-onde/o/tok')).toBe(true);
    expect(hasTabBar('/onde-onde/o/tok/placed')).toBe(true);
    expect(hasTabBar('/onde-onde/my-orders')).toBe(true);
    expect(hasTabBar('/onde-onde/settings')).toBe(true);
    expect(hasTabBar('/onde-onde/basket/pickup')).toBe(false);
  });

  it('isRootPage: the tab pages of a kitchen are roots, pages pushed on top are not', () => {
    expect(isRootPage('/onde-onde')).toBe(true);
    expect(isRootPage('/onde-onde/my-orders')).toBe(true);
    expect(isRootPage('/onde-onde/settings')).toBe(true);
    expect(isRootPage('/my-orders')).toBe(true);
    expect(isRootPage('/onde-onde/settings/start-fresh')).toBe(false);
    expect(isRootPage('/onde-onde/o/tok')).toBe(false);
    expect(isRootPage('/onde-onde/dishes')).toBe(false);
  });

  it('the tabs stay inside the kitchen when the app has one, else the all-kitchens pages', () => {
    expect(tabHref('orders', '/onde-onde', 'onde-onde')).toBe('/onde-onde/my-orders');
    expect(tabHref('settings', '/onde-onde', 'onde-onde')).toBe('/onde-onde/settings');
    expect(tabHref('orders', '/onde-onde', null)).toBe('/my-orders');
    expect(tabHref('settings', '/', null)).toBe('/settings');
    expect(tabHref('menu', '/onde-onde', 'onde-onde')).toBe('/onde-onde');
  });
});
