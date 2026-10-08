import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerCustomerI18n } from '../features/customer-menu';
import { registerSellerI18n } from '../features/seller-orders';
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
  registerSellerI18n();
  await i18n.changeLanguage('en');
});

describe('AppRoutes', () => {
  it('shows a not-found page with a link home for an unknown address', () => {
    renderAt('/nope/at/all');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the menu' })).toHaveAttribute('href', '/');
  });

  it('shows the My orders placeholder', () => {
    renderAt('/my-orders');
    expect(screen.getByText('My orders — coming in the next batch.')).toBeInTheDocument();
  });

  it('reads the seller filter and search from the URL', () => {
    renderAt('/seller?status=ready&q=rina');
    expect(screen.getByRole('radio', { name: /^Ready/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Order code or name')).toHaveValue('rina');
  });

  it('writes the seller filter and search to the URL, dropping the defaults', () => {
    renderAt('/seller');
    fireEvent.click(screen.getByRole('radio', { name: /^Done/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/seller?status=done');
    fireEvent.change(screen.getByLabelText('Order code or name'), { target: { value: 'tom' } });
    expect(screen.getByTestId('where')).toHaveTextContent('/seller?status=done&q=tom');
    fireEvent.click(screen.getByRole('radio', { name: /^All/ }));
    fireEvent.change(screen.getByLabelText('Order code or name'), { target: { value: '' } });
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/seller$/);
  });
});
