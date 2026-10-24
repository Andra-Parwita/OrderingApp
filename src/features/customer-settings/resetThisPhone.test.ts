import { beforeEach, describe, expect, it, vi } from 'vitest';

const signOutHere = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../api/customer/rememberMe', () => ({ signOutHere }));

import { ADDRESS_KEY } from '../../api/device/address';
import { FIRST_NAME_KEY } from '../../api/device/firstName';
import { LAST_KITCHEN_KEY, LAST_KITCHEN_THEME_KEY } from '../../api/device/lastKitchen';
import { MY_ORDERS_KEY } from '../../api/device/myOrders';
import { resetThisPhone } from './resetThisPhone';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signOutHere.mockClear();
});

describe('resetThisPhone', () => {
  it('signs out and clears My orders, name, address, language and the saved kitchen', async () => {
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify([{ token: 't1' }]));
    localStorage.setItem(FIRST_NAME_KEY, 'Sari');
    localStorage.setItem(ADDRESS_KEY, '{"street":"1 Main St"}');
    localStorage.setItem(LAST_KITCHEN_KEY, 'onde-onde');
    localStorage.setItem(LAST_KITCHEN_THEME_KEY, 'coral');
    localStorage.setItem('lang', 'id');
    localStorage.setItem('langChosen', '1');
    localStorage.setItem('themePreference', 'dark');
    sessionStorage.setItem('appKitchen', 'onde-onde');

    await resetThisPhone();

    expect(signOutHere).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? '[]')).toEqual([]);
    for (const key of [
      FIRST_NAME_KEY,
      ADDRESS_KEY,
      LAST_KITCHEN_KEY,
      LAST_KITCHEN_THEME_KEY,
      'lang',
      'langChosen',
    ]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(sessionStorage.getItem('appKitchen')).toBeNull();
    // Only what the plan lists: other settings stay.
    expect(localStorage.getItem('themePreference')).toBe('dark');
  });
});
