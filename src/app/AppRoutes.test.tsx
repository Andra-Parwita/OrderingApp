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
      '#16120e',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Match device' }));
    expect(localStorage.getItem('theme')).toBe('auto');
  });

  it('shows the bottom tab bar on a phone and the left rail on a desktop', () => {
    const phone = renderAt('/seller');
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/seller/more');
    expect(screen.getByRole('link', { name: 'Hand-over' })).toHaveAttribute(
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
    expect(within(rail).getByRole('link', { name: 'Cook list' })).toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: 'Hand-over' })).toBeInTheDocument();
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

  it('keeps the table behind an open order on a desktop, with the filter in the URL', () => {
    wide = true;
    renderAt('/seller/orders/K7F2QX?status=ready');
    expect(screen.getByLabelText('Find an order (code or name)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ready/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('dialog', { name: 'Order K7F-2QX' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('has one main landmark and one language switch on the desktop table', () => {
    wide = true;
    renderAt('/seller/orders/K7F2QX');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('radiogroup', { name: /language/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('lists the seller pages on More, and Menu is a live tab', () => {
    renderAt('/seller/more');
    for (const name of ['Settings', 'Week settings', 'Pictures', 'Chefs', 'Labels', 'Past weeks']) {
      expect(screen.getByRole('button', { name: new RegExp('^' + name) })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '/seller/menu');
    fireEvent.click(screen.getByRole('button', { name: /^Backup/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/seller/backup');
    expect(screen.getByRole('button', { name: 'Back to More' })).toBeInTheDocument();
  });

  it('previews the draft as a customer: seller bar on top, nothing orderable, no chef data', async () => {
    const item = {
      id: 'i1',
      name: { en: 'Preview dish', id: 'Hidangan' },
      description: { en: '', id: '' },
      size: { en: '', id: '' },
      priceCents: 1000,
      remaining: null,
      soldOut: false,
      chefId: 'chef-1',
    };
    const menu = {
      ...MENU,
      week: { ...MENU.week, status: 'draft' },
      chefs: [{ id: 'chef-1', sellerId: 's1', name: 'Secret Chef' }],
      items: [item],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json(menu))),
    );
    renderAt('/seller/menu/preview');
    expect(await screen.findByText('Preview dish')).toBeInTheDocument();
    expect(screen.getByText('Preview · not published yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to editing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add one Preview dish' })).toBeDisabled();
    expect(screen.queryByText('Secret Chef')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Seller' })).not.toBeInTheDocument();
  });

  it('puts the theme switch and the share link in the seller settings', () => {
    renderAt('/seller/settings');
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Share menu to WhatsApp' })).toHaveAttribute(
      'href',
      '/seller/share',
    );
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
  });
  it('reads the seller filter and search from the URL', () => {
    renderAt('/seller?status=ready&q=rina');
    expect(screen.getByRole('button', { name: /^Ready/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Order code or name')).toHaveValue('rina');
  });

  it('writes the seller filter and search to the URL, dropping the defaults', () => {
    renderAt('/seller');
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/seller?status=done');
    fireEvent.change(screen.getByLabelText('Order code or name'), { target: { value: 'tom' } });
    expect(screen.getByTestId('where')).toHaveTextContent('/seller?status=done&q=tom');
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    fireEvent.change(screen.getByLabelText('Order code or name'), { target: { value: '' } });
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
    expect(slot.parentElement?.parentElement).toHaveStyle({
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
    expect(banner.parentElement).toHaveAttribute('data-ratio', '2 / 1');
  });
});
