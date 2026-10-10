import { act, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerInstallI18n } from '../../components/install';
import { registerCustomerI18n } from '../../features/customer-menu';
import { registerCustomerOrdersI18n } from '../../features/customer-orders';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { FixturesPage } from './FixturesPage';

function renderAt(path: string) {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/__fixtures/:screenId"
            element={
              <FixturesPage
                tabBarHeight="3.5rem"
                tabBar={(active) => <nav aria-label="Customer">{active}</nav>}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
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

describe('customer fixtures page', () => {
  it('renders a placeholder for a screen that is not built yet, in the chosen language', async () => {
    renderAt('/__fixtures/no-such-screen?brand=bali&mode=dark');
    expect(
      await screen.findByRole('heading', { name: 'Not built yet: no-such-screen' }),
    ).toBeVisible();
    await act(() => i18n.changeLanguage('id'));
    expect(screen.getByRole('heading', { name: 'Belum dibuat: no-such-screen' })).toBeVisible();
    await act(() => i18n.changeLanguage('en'));
  });

  it('renders a screen from fixtures, with the tab bar the app hands in on a root screen', async () => {
    renderAt('/__fixtures/my-orders-empty');
    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Customer' })).toHaveTextContent('orders');
  });
});
