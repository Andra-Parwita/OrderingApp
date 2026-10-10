import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SELLER_KEY, currentSellerSlug } from '../api/device/sellerContext';
import { initI18n } from '../i18n/init';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/themes';
import { SellerPicker } from './SellerPicker';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => localStorage.removeItem(SELLER_KEY));

describe('SellerPicker (dev only)', () => {
  it('lists the sellers, shows the default, and stores the choice per device', async () => {
    const onChosen = vi.fn();
    render(
      <ThemeProvider theme={lightTheme}>
        <SellerPicker onChosen={onChosen} />
      </ThemeProvider>,
    );
    const select = await screen.findByLabelText('Seller (dev only)');
    expect(select).toHaveValue('onde-onde');
    expect(screen.getByRole('option', { name: 'Dapur Demo' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'dapur-demo' } });
    await waitFor(() => expect(onChosen).toHaveBeenCalled());
    expect(localStorage.getItem(SELLER_KEY)).toBe('dapur-demo');
    expect(currentSellerSlug()).toBe('dapur-demo');
  });

  it('ignores a stored value that is not a valid slug', () => {
    localStorage.setItem(SELLER_KEY, 'Not A Slug');
    expect(currentSellerSlug()).toBe('onde-onde');
  });
});
