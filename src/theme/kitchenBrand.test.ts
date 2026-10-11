import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_KITCHEN_THEME_KEY } from '../api/device/lastKitchen';

// Plan 024: the theme the page starts with, and what is remembered for pages with no kitchen.
async function load(path: string, serverBrand?: string) {
  window.history.replaceState(null, '', path);
  if (serverBrand) document.documentElement.dataset.brand = serverBrand;
  vi.resetModules();
  return import('./kitchenBrand');
}

describe('kitchenBrand', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    delete document.documentElement.dataset.brand;
    window.history.replaceState(null, '', '/');
  });

  it('starts from the server theme in the HTML and remembers it', async () => {
    const { initialKitchenBrand } = await load('/onde-onde', 'bali');
    expect(initialKitchenBrand()).toBe('bali');
    expect(localStorage.getItem(LAST_KITCHEN_THEME_KEY)).toBe('bali');
  });

  it('My orders opened directly uses the last kitchen theme; seller pages and unknown values do not', async () => {
    localStorage.setItem(LAST_KITCHEN_THEME_KEY, 'jawa');
    expect((await load('/my-orders')).initialKitchenBrand()).toBe('jawa');
    expect((await load('/seller/orders')).initialKitchenBrand()).toBe('onde');
    localStorage.setItem(LAST_KITCHEN_THEME_KEY, 'nope');
    expect((await load('/my-orders')).initialKitchenBrand()).toBe('onde');
  });

  it('a new theme from the server replaces the stored one on a kitchen page only', async () => {
    localStorage.setItem(LAST_KITCHEN_THEME_KEY, 'jawa');
    const kitchen = await load('/onde-onde');
    kitchen.setKitchenBrand('sunda');
    expect(localStorage.getItem(LAST_KITCHEN_THEME_KEY)).toBe('sunda');
    (await load('/seller/settings')).setKitchenBrand('onde');
    expect(localStorage.getItem(LAST_KITCHEN_THEME_KEY)).toBe('sunda');
  });
});
