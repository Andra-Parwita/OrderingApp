import { render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatOrderCode } from '../../shared/orderCode';
import { placeOrder } from '../api/client';
import { saveMyOrder } from '../api/device/myOrders';
import { registerInstallI18n } from '../components/install';
import { registerCustomerI18n } from '../features/customer-menu';
import { registerCustomerOrdersI18n } from '../features/customer-orders';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { createAppStore } from './store';

// D-120: My orders and Settings are per kitchen in the browser too. The slug-less addresses go to the
// last kitchen's page; with none known they keep the all-kitchens list.

function Probe() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

function renderAt(path: string) {
  return render(
    <Provider store={createAppStore()}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <Probe />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

const where = () => screen.getByTestId('where');

async function saved(slug: string, itemId: string) {
  const created = await placeOrder(slug, {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId, qty: 1 }],
  });
  if (!created.ok) throw new Error('could not place the sample order');
  saveMyOrder(created.data.order);
  return created.data.order;
}

const codeButton = (code: string) =>
  screen.queryByRole('button', { name: new RegExp(formatOrderCode(code)) });

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

describe('My orders per kitchen, in a browser tab (D-120)', () => {
  it('/<slug>/my-orders lists that kitchen only', async () => {
    const mine = await saved('onde-onde', 'tempe-mendoan');
    const other = await saved('dapur-demo', 'es-teh');
    const first = renderAt('/onde-onde/my-orders');
    expect(
      await screen.findByRole('button', { name: new RegExp(formatOrderCode(mine.code)) }),
    ).toBeVisible();
    expect(codeButton(other.code)).toBeNull();
    first.unmount();
    // The other kitchen's own page lists its order and not this one.
    renderAt('/dapur-demo/my-orders');
    expect(
      await screen.findByRole('button', { name: new RegExp(formatOrderCode(other.code)) }),
    ).toBeVisible();
    expect(codeButton(mine.code)).toBeNull();
  });

  it("/<slug>/my-orders with only another kitchen's orders shows the empty state, no link across", async () => {
    const other = await saved('dapur-demo', 'es-teh');
    renderAt('/onde-onde/my-orders');
    expect(await screen.findByText('Your orders will appear here')).toBeVisible();
    expect(codeButton(other.code)).toBeNull();
    expect(screen.queryByText(/Dapur Demo/)).toBeNull();
  });

  it('/my-orders goes to the last kitchen', async () => {
    const mine = await saved('onde-onde', 'tempe-mendoan');
    await saved('dapur-demo', 'es-teh');
    localStorage.setItem('lastKitchen', 'onde-onde');
    renderAt('/my-orders');
    await waitFor(() => expect(where()).toHaveTextContent(/^\/onde-onde\/my-orders$/));
    expect(
      await screen.findByRole('button', { name: new RegExp(formatOrderCode(mine.code)) }),
    ).toBeVisible();
  });

  it('/my-orders with no known kitchen stays and lists every kitchen', async () => {
    const mine = await saved('onde-onde', 'tempe-mendoan');
    const other = await saved('dapur-demo', 'es-teh');
    localStorage.removeItem('lastKitchen');
    renderAt('/my-orders');
    expect(
      await screen.findByRole('button', { name: new RegExp(formatOrderCode(mine.code)) }),
    ).toBeVisible();
    expect(codeButton(other.code)).toBeVisible();
    expect(where()).toHaveTextContent(/^\/my-orders$/);
  });

  it('/settings and /settings/start-fresh go to the last kitchen', async () => {
    localStorage.setItem('lastKitchen', 'dapur-demo');
    const settings = renderAt('/settings');
    await waitFor(() => expect(where()).toHaveTextContent(/^\/dapur-demo\/settings$/));
    settings.unmount();
    renderAt('/settings/start-fresh');
    await waitFor(() => expect(where()).toHaveTextContent(/^\/dapur-demo\/settings\/start-fresh$/));
  });

  it('/settings with no known kitchen stays', async () => {
    renderAt('/settings');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(where()).toHaveTextContent(/^\/settings$/);
  });
});
