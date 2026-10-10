import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { registerCustomerI18n } from '../features/customer-menu';
import { registerCustomerOrdersI18n } from '../features/customer-orders';
import { registerCookI18n } from '../features/seller-cook';
import { registerSellerI18n } from '../features/seller-orders';
import { registerSellerHistoryI18n } from '../features/seller-history';
import { registerSellerLabelsI18n } from '../features/seller-labels';
import { registerSellerMenuI18n } from '../features/seller-menu';
import { registerSettingsI18n } from '../features/seller-settings';
import { registerSellerSetupI18n } from '../features/seller-setup';
import { registerShareI18n } from '../features/seller-share';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { createAppStore } from './store';

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderAt(path: string) {
  return render(
    <Provider store={createAppStore()}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <Where />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

let wide = false;

afterEach(() => {
  wide = false;
  localStorage.clear();
  vi.unstubAllGlobals();
});

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('min-width') ? wide : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerCustomerI18n();
  registerCustomerOrdersI18n();
  registerSellerI18n();
  registerCookI18n();
  registerShareI18n();
  registerSettingsI18n();
  registerSellerMenuI18n();
  registerSellerSetupI18n();
  registerSellerLabelsI18n();
  registerSellerHistoryI18n();
  await i18n.changeLanguage('en');
});

const MENU = {
  seller: { id: 's1', slug: 'onde-onde', name: 'Delave' },
  kitchen: {
    sellerId: 's1',
    name: 'Delave',
    tagline: { en: 'a', id: 'b' },
    images: {
      desktopBanner: '/samples/banner-wide.jpg',
      phoneBanner: '/samples/banner-phone.jpg',
      alt: { en: 'Onde Onde banner', id: 'Banner Onde Onde' },
    },
  },
  week: {
    cookingDate: '2026-10-10',
    cutoffAt: '2026-10-09T21:00:00+11:00',
    status: 'published',
    pickupPoints: [],
    delivery: { available: false, note: { en: 'a', id: 'b' } },
  },
  items: [],
  ordering: { open: true },
};

function stubMenu(images: Record<string, unknown> = MENU.kitchen.images) {
  const menu = { ...MENU, kitchen: { ...MENU.kitchen, images } };
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(menu))),
  );
}

describe('AppRoutes', () => {
  it('shows a not-found page with a link home for an unknown address', () => {
    renderAt('/nope/at/all');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the menu' })).toHaveAttribute('href', '/');
  });

  it('shows the theme switch in the customer Settings, and remembers the choice', () => {
    renderAt('/settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#121411',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(localStorage.getItem('theme')).toBe('auto');
  });

  it('shows the bottom tab bar on a phone and the left rail on a desktop', () => {
    const phone = renderAt('/seller');
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/seller/more');
    expect(screen.getByRole('link', { name: 'Pickup & delivery' })).toHaveAttribute(
      'href',
      '/seller/hand-over',
    );
    phone.unmount();

    wide = true;
    renderAt('/seller');
    expect(screen.getByRole('navigation', { name: 'Seller' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup', { name: /language/i })).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('collapses the rail to icons, remembers it, and names every item on focus', () => {
    wide = true;
    const first = renderAt('/seller');
    const rail = screen.getByRole('navigation', { name: 'Seller' });
    const toggle = within(rail).getByRole('button', { name: 'Collapse menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    const expand = within(rail).getByRole('button', { name: 'Expand menu' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem('sellerRailCollapsed')).toBe('1');
    // Names stay for assistive tech; the current page is still marked.
    const orders = within(rail).getByRole('link', { name: 'Orders' });
    expect(orders).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('link', { name: 'Kitchen' })).toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: 'Pickup & delivery' })).toBeInTheDocument();
    expect(within(rail).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Language: EN/ })).toBeInTheDocument();
    expect(within(rail).queryByText('Orders', { selector: '[aria-hidden]' })).toBeNull();
    fireEvent.focus(orders);
    expect(within(rail).getByText('Orders', { selector: 'span[aria-hidden]' })).toBeInTheDocument();
    first.unmount();

    // A new visit starts collapsed, and the button expands it again.
    renderAt('/seller');
    const again = screen.getByRole('button', { name: 'Expand menu' });
    fireEvent.click(again);
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(localStorage.getItem('sellerRailCollapsed')).toBe('0');
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
  });

  it('keeps the table beside an open order on a desktop, with the filter in the URL', async () => {
    wide = true;
    renderAt('/seller/orders/K7F2QX?status=ready');
    expect(await screen.findByLabelText('Name or code', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ready/ })).toHaveAttribute('aria-pressed', 'true');
    // The order opens in a panel beside the list, not over it.
    expect(screen.getByRole('complementary', { name: 'Order K7F2QX' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has one main landmark and one language switch on the desktop table', async () => {
    wide = true;
    renderAt('/seller/orders/K7F2QX');
    await screen.findByLabelText('Name or code', {}, { timeout: 5000 });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('radiogroup', { name: /language/i })).toHaveLength(1);
    expect(screen.getByRole('complementary', { name: 'Order K7F2QX' })).toBeInTheDocument();
  });

  it('shows the phone More page with its tab marked, and sends the owner on a tablet to Settings', () => {
    const phone = renderAt('/seller/more');
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'More' })).toBeInTheDocument();
    phone.unmount();

    wide = true;
    renderAt('/seller/more');
    expect(screen.getByTestId('where')).toHaveTextContent('/seller/settings/kitchen');
  });

  it('has no customer preview route any more: the Check step of Make a menu replaces it', () => {
    renderAt('/seller/menu/preview');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('puts the light, dark and auto switch in the seller Appearance settings', async () => {
    wide = true;
    renderAt('/seller/settings/look');
    expect(
      await screen.findByRole('radio', { name: 'Light' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the share page from the Orders header', async () => {
    wide = true;
    renderAt('/seller');
    fireEvent.click(await screen.findByRole('button', { name: 'More' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share menu' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/seller/share');
  });

  it('reads the seller filter and search from the URL', async () => {
    wide = true;
    renderAt('/seller?status=ready&q=rina');
    expect(await screen.findByLabelText('Name or code', {}, { timeout: 5000 })).toHaveValue('rina');
    expect(screen.getByRole('button', { name: /^Ready/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes the seller filter and search to the URL, dropping the defaults', async () => {
    wide = true;
    renderAt('/seller');
    await screen.findByLabelText('Name or code', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/seller?status=done');
    fireEvent.change(screen.getByLabelText('Name or code'), { target: { value: 'tom' } });
    expect(screen.getByTestId('where')).toHaveTextContent('/seller?status=done&q=tom');
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    fireEvent.change(screen.getByLabelText('Name or code'), { target: { value: '' } });
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/seller$/);
  });

  it('shows the rail image placeholder and the desktop banner on a desktop seller page', async () => {
    stubMenu();
    wide = true;
    renderAt('/seller');
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    expect(banner).toHaveAttribute('src', '/samples/banner-wide.jpg');
    const rail = screen.getByRole('navigation', { name: 'Seller' });
    expect(within(rail).getByRole('img', { name: 'Delave — Rail image' })).toBeInTheDocument();
    expect(within(rail).getByText('Rail image — coming soon')).toBeInTheDocument();
  });

  it('shows the whole desktop banner on the seller background colour, never cropped', async () => {
    stubMenu({ ...MENU.kitchen.images, bannerBackground: '#835937' });
    wide = true;
    renderAt('/seller');
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    const slot = banner.parentElement as HTMLElement;
    expect(slot).toHaveAttribute('data-fit', 'contain');
    expect(slot).toHaveAttribute('data-ratio', '5 / 1');
    expect(slot).toHaveStyle({ background: 'rgb(131, 89, 55)' });
    expect(slot.parentElement?.parentElement?.parentElement).toHaveStyle({
      backgroundColor: 'rgb(131, 89, 55)',
    });
    expect(banner).toHaveStyle({ objectFit: 'contain' });
  });

  it('shows the rail image, expanded, at 2:1', async () => {
    stubMenu({ ...MENU.kitchen.images, railImage: '/samples/rail.png' });
    wide = true;
    renderAt('/seller');
    const rail = screen.getByRole('navigation', { name: 'Seller' });
    const image = await within(rail).findByRole('img', { name: 'Delave — Rail image' });
    expect(image).toHaveAttribute('src', '/samples/rail.png');
    expect(image.parentElement).toHaveAttribute('data-ratio', '2 / 1');
  });

  it('shows the rail icon, collapsed, when there is one', async () => {
    localStorage.setItem('sellerRailCollapsed', '1');
    stubMenu({ ...MENU.kitchen.images, railIcon: '/samples/icon.png' });
    wide = true;
    renderAt('/seller');
    const rail = screen.getByRole('navigation', { name: 'Seller' });
    await waitFor(() =>
      expect(within(rail).getByRole('img', { name: 'Delave' })).toHaveAttribute(
        'src',
        '/samples/icon.png',
      ),
    );
    expect(within(rail).queryByText('Rail image — coming soon')).toBeNull();
  });

  it('shows the seller initial in a circle, collapsed, when there is no icon', () => {
    localStorage.setItem('sellerRailCollapsed', '1');
    stubMenu();
    wide = true;
    renderAt('/seller');
    const rail = screen.getByRole('navigation', { name: 'Seller' });
    const initial = within(rail).getByRole('img', { name: 'Kitchen' });
    expect(initial).toHaveTextContent('K');
    expect(initial).toHaveStyle({ borderRadius: '50%' });
    expect(within(rail).queryByText(/coming soon$/)).toBeNull();
  });

  it('shows one banner, the phone one, on top of a phone seller page', async () => {
    stubMenu();
    renderAt('/seller');
    const banner = await screen.findByRole('img', { name: 'Onde Onde banner' });
    expect(banner).toHaveAttribute('src', '/samples/banner-phone.jpg');
    expect(document.querySelectorAll('img')).toHaveLength(1);
    expect(banner.parentElement).toHaveAttribute('data-fit', 'contain');
    expect(banner.parentElement).toHaveAttribute('data-ratio', '3 / 1');
  });
});
