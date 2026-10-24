import { render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { placeOrder } from '../api/client';
import { lastKitchen } from '../api/device/lastKitchen';
import { registerInstallI18n } from '../components/install';
import { registerCustomerI18n } from '../features/customer-menu';
import { registerCustomerOrdersI18n } from '../features/customer-orders';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { tabHref } from './CustomerShell';
import { createAppStore } from './store';

// 1.0.44 customer check: a link for one kitchen never lands on another kitchen's pages, and the tab
// title names the kitchen (two kitchens' bookmarks must look different).

function renderAt(path: string) {
  return render(
    <Provider store={createAppStore()}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

const tabBar = () => screen.getByRole('navigation', { name: /^(Customer|Pelanggan)$/ });
const href = (name: string) => within(tabBar()).getByRole('link', { name }).getAttribute('href');

async function dapurOrderToken(): Promise<string> {
  const created = await placeOrder('dapur-demo', {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'es-teh', qty: 1 }],
  });
  if (!created.ok) throw new Error('could not place the sample order');
  return created.data.order.token;
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerCustomerI18n();
  registerCustomerOrdersI18n();
  registerInstallI18n();
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('tabHref', () => {
  it('uses the kitchen when there is one, the slug-less pages only without', () => {
    expect(tabHref('settings', '/x', 'dapur-demo')).toBe('/dapur-demo/settings');
    expect(tabHref('orders', '/x', 'dapur-demo')).toBe('/dapur-demo/my-orders');
    expect(tabHref('settings', '/x', null)).toBe('/settings');
    expect(tabHref('orders', '/x', null)).toBe('/my-orders');
    expect(tabHref('menu', '/x', 'dapur-demo')).toBe('/x');
  });
});

describe('a link for one kitchen, in a browser tab (not installed)', () => {
  it("keeps Settings and My orders on the order page's kitchen, whatever kitchen was last", async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    const token = await dapurOrderToken();
    renderAt(`/dapur-demo/o/${token}`);
    expect(await screen.findByRole('button', { name: 'Back to My orders' })).toBeVisible();
    expect(href('Settings')).toBe('/dapur-demo/settings');
    expect(href('My orders')).toBe('/dapur-demo/my-orders');
    expect(href('Menu')).toBe('/dapur-demo');
  });

  it('keeps the slug-less pages on a slug-less address', () => {
    renderAt('/settings');
    expect(href('Settings')).toBe('/settings');
    expect(href('My orders')).toBe('/my-orders');
  });

  it('opening a kitchen order page makes that kitchen the remembered one', async () => {
    localStorage.setItem('lastKitchen', 'onde-onde');
    const token = await dapurOrderToken();
    renderAt(`/dapur-demo/o/${token}`);
    await waitFor(() => expect(lastKitchen()).toBe('dapur-demo'));
  });
});

describe('the tab title', () => {
  it('names the kitchen on its menu', async () => {
    renderAt('/dapur-demo');
    await screen.findByRole('heading', { name: 'Dapur Demo' });
    await waitFor(() => expect(document.title).toBe('Dapur Demo'));
  });

  it('on an order page: "<Kitchen> · Order", the word in the customer language', async () => {
    const token = await dapurOrderToken();
    await i18n.changeLanguage('id');
    renderAt(`/dapur-demo/o/${token}`);
    await waitFor(() => expect(document.title).toBe('Dapur Demo · Pesanan'));
  });
});
