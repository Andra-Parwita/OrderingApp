import { render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { AdminHomeScreen, registerAdminI18n } from '../features/admin';
import { initI18n } from '../i18n/init';
import { brandColour } from '../theme/brandTokens';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { ADMIN_BOTTOM, ADMIN_TOP } from './AuthRoutes';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerAdminI18n();
  await i18n.changeLanguage('en');
});

describe('the admin page frame (plan 038)', () => {
  it('carries the ShaggyBobo brand bar with Admin and Sign out, and the brand footer', () => {
    render(
      <AppThemeProvider>
        <AdminHomeScreen top={ADMIN_TOP} bottom={ADMIN_BOTTOM} />
      </AppThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'ShaggyBobo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('v1.0.42')).toBeInTheDocument();
  });

  it('shows the unselected language option in the brand ink on the beige bar', () => {
    render(
      <AppThemeProvider>
        <AdminHomeScreen top={ADMIN_TOP} bottom={ADMIN_BOTTOM} />
      </AppThemeProvider>,
    );
    const group = screen.getByRole('radiogroup');
    const unselected = within(group).getByRole('radio', { checked: false });
    expect(unselected).toHaveStyle({ color: brandColour.ink });
    expect(group).toHaveStyle({ borderColor: brandColour.ink });
  });
});
