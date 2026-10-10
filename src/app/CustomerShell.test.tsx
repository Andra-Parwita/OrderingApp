import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/server';
import type { CustomerOrder } from '../../shared/domain';
import indexHtml from '../../index.html?raw';
import { placeOrder } from '../api/client';
import { saveMyOrder } from '../api/device/myOrders';
import { placeRequested, quantitySet, registerCustomerI18n } from '../features/customer-menu';
import { registerInstallI18n } from '../components/install';
import { registerCustomerOrdersI18n } from '../features/customer-orders';
import { initI18n } from '../i18n/init';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { GlobalStyle } from '../theme/GlobalStyle';
import { lightTheme } from '../theme/themes';
import { AppRoutes } from './AppRoutes';
import { CustomerPage } from '../components/CustomerPage';
import { activeTab, hasTabBar, isRootPage } from './CustomerShell';
import { createAppStore } from './store';
import { DEFAULT_SELLER_SLUG } from '../../shared/seller';

let navigateTo: NavigateFunction = () => undefined;

function Probe() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    navigateTo = navigate;
  }, [navigate]);
  return <output data-testid="where">{pathname}</output>;
}

function renderAt(path: string, store = createAppStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
            <Probe />
          </MemoryRouter>
        </AppThemeProvider>
      </Provider>,
    ),
  };
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
  await i18n.changeLanguage('en');
});

/**
 * All the CSS: the page's style text plus the app's global style, rendered on its own (jsdom does
 * not keep the global rules in the document's style tags).
 */
function pageCss(): string {
  const text = Array.from(document.querySelectorAll('style')).map((style) => style.textContent);
  const sheet = new ServerStyleSheet();
  renderToString(
    sheet.collectStyles(
      <ThemeProvider theme={lightTheme}>
        <GlobalStyle />
      </ThemeProvider>,
    ),
  );
  const global = sheet.getStyleTags();
  sheet.seal();
  return [...text, global].join('');
}

const tabBar = () => screen.getByRole('navigation', { name: /^(Customer|Pelanggan)$/ });

describe('customer tab bar', () => {
  it('has Menu, My orders and Settings, and marks the current one', () => {
    renderAt('/settings');
    const links = within(tabBar()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Menu', 'My orders', 'Settings']);
    expect(within(tabBar()).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabBar()).getByRole('link', { name: 'Menu' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps Menu current for the basket and My orders current for every order page', () => {
    expect(activeTab('/')).toBe('menu');
    expect(activeTab('/onde-onde')).toBe('menu');
    expect(activeTab('/onde-onde/basket')).toBe('menu');
    expect(activeTab('/my-orders')).toBe('orders');
    expect(activeTab('/o/abc')).toBe('orders');
    expect(activeTab('/o/abc/placed')).toBe('orders');
    expect(activeTab('/o/abc/edit')).toBe('orders');
    expect(activeTab('/settings')).toBe('settings');
  });

  it('hides the tab bar on checkout pages and shows it elsewhere', () => {
    expect(hasTabBar('/onde-onde/basket')).toBe(false);
    expect(hasTabBar('/o/abc/edit')).toBe(false);
    expect(hasTabBar('/onde-onde/basket/pickup')).toBe(false);
    expect(hasTabBar('/onde-onde/basket/name')).toBe(false);
    expect(hasTabBar('/o/abc/edit/name')).toBe(false);
    expect(hasTabBar('/o/abc/qr')).toBe(false);
    expect(hasTabBar('/onde-onde')).toBe(true);
    expect(hasTabBar('/o/abc')).toBe(true);
    expect(hasTabBar('/o/abc/placed')).toBe(true);
    expect(isRootPage('/my-orders')).toBe(true);
    expect(isRootPage('/onde-onde/basket')).toBe(false);
    renderAt('/onde-onde/basket');
    expect(screen.queryByRole('navigation', { name: 'Customer' })).toBeNull();
  });

  it('shows the right tab on an order page', () => {
    renderAt('/o/some-token');
    expect(within(tabBar()).getByRole('link', { name: 'My orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('is at least 44 px tall and pads for the bottom safe area', () => {
    renderAt('/settings');
    const css = pageCss();
    // Tab height 3.5rem = 56 px, above the 44 px minimum.
    const height = /min-height:\s*([\d.]+)rem/.exec(css);
    expect(parseFloat(height?.[1] ?? '0') * 16).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/padding-bottom:\s*var\(--sab/);
    expect(css).toMatch(/--sat:\s*env\(safe-area-inset-top/);
    expect(css).toMatch(/max-width:\s*30rem/);
  });

  it('shows a dot, with text for screen readers, only when an order has an unread update', async () => {
    const created = await placeOrder(DEFAULT_SELLER_SLUG, {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
    });
    if (!created.ok) throw new Error('could not place the sample order');
    const placed = created.data.order;
    saveMyOrder(placed);

    const first = renderAt('/onde-onde');
    await waitFor(() =>
      expect(within(tabBar()).getByRole('link', { name: 'My orders' })).toBeVisible(),
    );
    expect(within(tabBar()).queryByText(/new update/)).not.toBeInTheDocument();
    first.unmount();
    // Serve an inbox entry newer than the one this phone has seen.
    const nudged: CustomerOrder = {
      ...placed,
      inbox: [{ at: '2026-10-08T09:00:00.000Z', kind: 'nudge', textKey: 'nudge' }, ...placed.inbox],
    };
    server.use(http.get('*/api/orders', () => HttpResponse.json({ orders: [nudged] })));
    renderAt('/onde-onde');
    expect(await within(tabBar()).findByText(/new update/)).toBeInTheDocument();
    expect(within(tabBar()).getByRole('link', { name: 'My orders, new update' })).toBeVisible();
  });
});

describe('customer pushed pages', () => {
  it('names the previous page on the Back button and shows the kitchen name without a logo', () => {
    const onBack = vi.fn();
    render(
      <AppThemeProvider>
        <CustomerPage title="Dishes" kitchenName="Onde Onde" backLabel="Menu" onBack={onBack} />
      </AppThemeProvider>,
    );
    const back = screen.getByRole('button', { name: 'Back to Menu' });
    expect(back).toHaveTextContent('Menu');
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Dishes' })).toBeVisible();
    expect(screen.getByText('Onde Onde')).toBeVisible();
  });

  it('shows the wide logo when there is one', () => {
    render(
      <AppThemeProvider>
        <CustomerPage title="Basket" kitchenName="Onde Onde" logoSrc="/logo.png" />
      </AppThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'Onde Onde' })).toHaveAttribute('src', '/logo.png');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('slides pages in from the right, and drops every animation for reduced motion', async () => {
    renderAt('/settings');
    act(() => void navigateTo('/onde-onde/basket'));
    await screen.findByRole('heading', { name: 'Your basket' });
    const css = pageCss();
    expect(css).toMatch(/translateX\(100%\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*animation:\s*none\s*!important/);
  });
});

describe('customer Settings', () => {
  it('switches the language and remembers it', async () => {
    renderAt('/settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'ID' }));
    expect(await screen.findByRole('heading', { name: 'Pengaturan' })).toBeInTheDocument();
    expect(localStorage.getItem('lang')).toBe('id');
    expect(within(tabBar()).getByRole('link', { name: 'Pesanan saya' })).toBeInTheDocument();
  });

  it('switches the theme and remembers it', () => {
    renderAt('/settings');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(localStorage.getItem('theme')).toBe('dark');
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(localStorage.getItem('theme')).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(localStorage.getItem('theme')).toBe('auto');
  });

  it('shows Order updates as a disabled switch where the browser cannot get notifications', () => {
    // jsdom has no PushManager, as with an old browser.
    renderAt('/settings');
    const updates = screen.getByRole('switch', { name: 'Order updates' });
    expect(updates).toBeDisabled();
    expect(updates).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Not available in this browser')).toBeVisible();
  });

  it('offers the home-screen card on a phone only, not on a desktop browser', () => {
    // The card itself (iPhone guide, Android Install) is covered in CustomerSettingsView.test.
    renderAt('/settings');
    expect(screen.queryByText('Put it on your home screen')).toBeNull();
  });
});

describe('customer menu as a native app', () => {
  it('starts with the banner and no EN / ID toggle (Settings only), then the name', async () => {
    const { container } = renderAt('/onde-onde');
    const heading = await screen.findByRole('heading', { name: 'Onde Onde' });
    const banner = screen.getByRole('img', { name: /Onde Onde/ });
    const first = container.querySelector('img, h1, button, a, [role="radiogroup"], nav');
    expect(first).toBe(banner);
    expect(screen.queryByRole('radiogroup', { name: 'Language' })).toBeNull();
    expect(banner.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(screen.getByRole('main')).queryByRole('button', { name: 'My orders' }),
    ).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });
});

describe('basket after ordering', () => {
  it('opens empty on the next visit instead of redirecting to the old order', async () => {
    const { store } = renderAt('/onde-onde/basket');
    await waitFor(() => {
      store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
      expect(store.getState().customer.basket).toEqual({ 'tempe-mendoan': 1 });
    });
    act(() => {
      store.dispatch(
        placeRequested({ firstName: 'Rina', language: 'en', fulfilment: 'pickup', note: '' }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId('where').textContent).toMatch(/^\/o\/.+\/placed$/),
    );

    act(() => void navigateTo('/onde-onde/basket'));
    // Give a stale "placed" result the chance to redirect, as it would without the reset.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/onde-onde\/basket$/);
    expect(store.getState().customer.place).toEqual({ status: 'idle' });
  });
});

describe('customer sub-page headers', () => {
  async function savedToken(): Promise<string> {
    const created = await placeOrder(DEFAULT_SELLER_SLUG, {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
    });
    if (!created.ok) throw new Error('could not place the sample order');
    saveMyOrder(created.data.order);
    return created.data.order.token;
  }

  const where = () => screen.getByTestId('where');

  it('puts the viewport under the notch', () => {
    expect(indexHtml).toMatch(/<meta name="viewport"[^>]*viewport-fit=cover/);
  });

  it('basket: back goes to the menu', async () => {
    // A first-timer is sent to "How ordering works" from the menu; this phone has seen it.
    localStorage.setItem('howItWorksSeen', '1');
    renderAt('/onde-onde/basket');
    expect(await screen.findByRole('heading', { name: 'Your basket' })).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Back to Dishes' }));
    await waitFor(() => expect(where()).toHaveTextContent(/^\/onde-onde$/));
  });

  it('My orders: no back arrow (tab root); the language switch lives in Settings only', async () => {
    renderAt('/my-orders');
    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Language' })).toBeNull();
  });

  it('order page: back goes to My orders, named in the chosen language', async () => {
    const token = await savedToken();
    renderAt(`/o/${token}`);
    expect(await screen.findByRole('button', { name: 'Back to My orders' })).toBeVisible();
    await act(() => i18n.changeLanguage('id'));
    const back = await screen.findByRole('button', { name: /^Kembali ke/ });
    fireEvent.click(back);
    await waitFor(() => expect(where()).toHaveTextContent('/my-orders'));
  });

  it('order placed: no back arrow; View order details goes to the order page', async () => {
    const token = await savedToken();
    renderAt(`/o/${token}/placed`);
    expect(await screen.findByRole('heading', { name: 'Order placed' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Back/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View order details' }));
    await waitFor(() => expect(where()).toHaveTextContent(`/o/${token}`));
    expect(where()).not.toHaveTextContent('placed');
  });

  it('edit basket: back goes to the order page', async () => {
    const token = await savedToken();
    renderAt(`/o/${token}/edit`);
    expect(await screen.findByRole('heading', { name: 'Change your order' })).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Back to Order' }));
    await waitFor(() => expect(where()).toHaveTextContent(new RegExp(`^/o/${token}$`)));
  });

  it('keeps one back button per checkout page', async () => {
    renderAt('/onde-onde/basket');
    await screen.findByRole('heading', { name: 'Your basket' });
    // One back arrow in the top bar; the empty basket's own "Back to the menu" button is a
    // separate action in the page body.
    expect(await screen.findAllByRole('button', { name: 'Back to Dishes' })).toHaveLength(1);
  });
});

describe('customer routes per seller (D-037)', () => {
  it('shows a simple home page at / with no list of sellers', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { name: "ShaggyBobo's Order · Weekly home-cooked orders" }),
    ).toBeVisible();
    expect(screen.getByText("Open your seller's link from WhatsApp.")).toBeVisible();
    expect(screen.queryByText('Onde Onde')).toBeNull();
    expect(screen.queryByText('Dapur Demo')).toBeNull();
    expect(within(tabBar()).getAllByRole('link')).toHaveLength(3);
  });

  it('loads the menu of the seller in the route, and the basket for the same seller', async () => {
    const { store } = renderAt('/dapur-demo');
    expect(await screen.findByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
    expect(store.getState().customer.slug).toBe('dapur-demo');
    expect(screen.queryByText('Lime-leaf mixed rice')).toBeNull();
  });

  it('shows the not-found page, keeping the tab bar, for an unknown seller', async () => {
    renderAt('/no-such-kitchen');
    expect(
      await screen.findByRole('heading', { name: "We couldn't find this kitchen" }),
    ).toBeVisible();
    expect(within(tabBar()).getAllByRole('link')).toHaveLength(3);
  });

  it('shows the not-found page without asking the server for a malformed or reserved slug', async () => {
    const asked: Array<string> = [];
    server.events.on('request:start', ({ request }) => asked.push(new URL(request.url).pathname));
    renderAt('/Not_A_Slug');
    expect(
      await screen.findByRole('heading', { name: "We couldn't find this kitchen" }),
    ).toBeVisible();
    expect(asked.some((path) => path.startsWith('/api/s/'))).toBe(false);
    server.events.removeAllListeners();
  });

  it('keeps the reserved routes working', () => {
    renderAt('/my-orders');
    expect(screen.getByRole('heading', { name: 'My orders' })).toBeVisible();
  });

  it('points the Menu tab at the last seller menu visited, else at /', async () => {
    const first = renderAt('/settings');
    expect(within(tabBar()).getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '/');
    first.unmount();
    renderAt('/dapur-demo');
    await screen.findByRole('heading', { name: 'Dapur Demo' });
    await waitFor(() =>
      expect(within(tabBar()).getByRole('link', { name: 'Menu' })).toHaveAttribute(
        'href',
        '/dapur-demo',
      ),
    );
    act(() => void navigateTo('/settings'));
    expect(within(tabBar()).getByRole('link', { name: 'Menu' })).toHaveAttribute(
      'href',
      '/dapur-demo',
    );
  });

  it("opens an order's edit basket on that order's seller", async () => {
    const created = await placeOrder('dapur-demo', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'es-teh', qty: 1 }],
    });
    if (!created.ok) throw new Error('could not place the sample order');
    saveMyOrder(created.data.order);
    const { store } = renderAt(`/o/${created.data.order.token}/edit`);
    expect(await screen.findByText('Iced sweet tea')).toBeVisible();
    expect(store.getState().customer.slug).toBe('dapur-demo');
  });
});
