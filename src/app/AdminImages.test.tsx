import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pngFor } from '../../mocks/images';
import { browserPasskeys } from '../../mocks/browserPasskeys';
import { clearCookies, installCookieJar } from '../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../mocks/handlers';
import { adminSetup, registerDevice } from '../api/auth';
import { AdminHomeScreen, registerAdminI18n } from '../features/admin';
import { registerSellerSetupI18n, type ResizeFn } from '../features/seller-setup';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { MemoryRouter } from 'react-router';
import { AdminHomeRoute, AdminKitchenImages } from './AuthRoutes';

// The browser's passkey prompt is a software authenticator; the server's checks are the real ones.
vi.mock(
  '@simplewebauthn/browser',
  async () => (await import('../../mocks/browserPasskeys')).browserMock,
);

let restoreFetch: () => void;
afterAll(() => restoreFetch());

beforeAll(async () => {
  restoreFetch = installCookieJar();
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerAdminI18n();
  registerSellerSetupI18n();
  await i18n.changeLanguage('en');
});

beforeEach(async () => {
  await mockStores.reset();
  clearCookies();
  browserPasskeys.reset();
  expect((await adminSetup(DEV_ADMIN_SETUP_KEY)).ok).toBe(true);
  expect((await registerDevice({ kind: 'passkey', deviceName: 'Test PC' })).ok).toBe(true);
});

const ICON = 'App icon (phone home screen and closed menu)';

describe('the admin sets the images of a kitchen (plan 041)', () => {
  it('shows the five slots with size lines and guides in the open seller row, and uploads one', async () => {
    const dataUrl = pngFor('phoneBanner', 7);
    const resize = vi.fn<ResizeFn>().mockResolvedValue({
      dataUrl,
      offRatio: false,
      sourceWidth: 1200,
      sourceHeight: 400,
    });
    render(
      <AppThemeProvider>
        <AdminHomeScreen images={(id) => <AdminKitchenImages sellerId={id} resize={resize} />} />
      </AppThemeProvider>,
    );
    expect(
      await screen.findByText(
        "This page manages access and the kitchen's pictures. It shows no orders or customers.",
      ),
    ).toBeInTheDocument();
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(sellers).getByRole('button', { name: /Onde Onde/ }));
    const region = await screen.findByRole('dialog', { name: 'Onde Onde' });
    fireEvent.click(within(region).getByRole('tab', { name: 'Settings' }));
    expect(within(region).getByText('Images')).toBeInTheDocument();
    for (const name of [
      'Wide banner (tablet and computer)',
      'Phone banner',
      'Menu image (left menu)',
      ICON,
      'Background (wide screens)',
    ]) {
      expect(await within(region).findByRole('heading', { name })).toBeInTheDocument();
    }
    expect(
      within(region).getAllByRole('button', { name: 'How to make this picture' }),
    ).toHaveLength(5);
    expect(within(region).getAllByText(/ px · /).length).toBeGreaterThanOrEqual(5);

    fireEvent.change(within(region).getByLabelText('Choose a picture for Phone banner'), {
      target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect(within(region).getByAltText('Phone banner')).toHaveAttribute('src', dataUrl),
    );
    expect(
      (await (await mockStores.sellerById('seller-onde-onde'))?.getImages())?.phoneBanner,
    ).toBe(dataUrl);
  });

  it('the real admin route puts the Images editor in the Settings tab', async () => {
    render(
      <AppThemeProvider>
        <MemoryRouter>
          <AdminHomeRoute />
        </MemoryRouter>
      </AppThemeProvider>,
    );
    const sellers = await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(within(sellers).getByRole('button', { name: /Onde Onde/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Onde Onde' });
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Settings' }));
    expect(
      await within(dialog).findByRole('heading', { name: 'Wide banner (tablet and computer)' }),
    ).toBeInTheDocument();
  });
});
