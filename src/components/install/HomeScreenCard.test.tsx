import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { lightTheme } from '../../theme/themes';
import type { Environment } from './detect';
import { HOME_CARD_KEY, HomeScreenCard } from './HomeScreenCard';
import { registerInstallI18n } from './i18n/register';
import { setSavedInstallPrompt } from './installPrompt';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {},
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
});
beforeEach(() => localStorage.removeItem(HOME_CARD_KEY));
afterEach(() => {
  setSavedInstallPrompt(null);
  vi.restoreAllMocks();
});

const android: Environment = {
  platform: 'android',
  inApp: false,
  inAppName: null,
  safari: false,
  installed: false,
  pushSupported: true,
  permission: 'default',
};
const iphone: Environment = { ...android, platform: 'ios', safari: true };

const show = (env: Environment, who: 'customer' | 'seller' = 'customer') =>
  render(
    <ThemeProvider theme={lightTheme}>
      <HomeScreenCard who={who} kitchenName="Onde Onde" override={{ env }} />
    </ThemeProvider>,
  );

describe('HomeScreenCard (plan 054)', () => {
  it('is hidden when opened from the home screen', () => {
    show({ ...android, installed: true });
    expect(screen.queryByTestId('home-screen-card')).toBeNull();
    show({ ...iphone, installed: true });
    expect(screen.queryByTestId('home-screen-card')).toBeNull();
  });

  it('Android with an install offer: one tap opens the browser dialog', () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    show(android);
    act(() =>
      setSavedInstallPrompt({
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      } as never),
    );
    expect(screen.getByText('Put Onde Onde on your home screen')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('iPhone: the same "Install app" button opens the picture steps', () => {
    show(iphone);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('Android without an install offer: the same label opens the one by-hand screen', () => {
    show(android);
    expect(screen.queryByRole('button', { name: /home screen/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Install from your browser' })).toBeVisible();
    expect(screen.getByText(/Add to Home screen/)).toBeVisible();
    expect(screen.queryByText(/Create shortcut/)).toBeNull();
  });

  it('Android inside WhatsApp keeps the Open in Chrome screen', () => {
    show({ ...android, inApp: true, inAppName: 'WhatsApp' });
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByRole('heading', { name: 'First, open this page in Chrome' })).toBeVisible();
  });

  it('a desktop browser that cannot install shows nothing', () => {
    show({ ...android, platform: 'desktop' });
    expect(screen.queryByTestId('home-screen-card')).toBeNull();
  });

  it('the seller wording, in Indonesian too', async () => {
    show(iphone, 'seller');
    expect(screen.getByText('Put the seller app on your home screen')).toBeVisible();
    await act(() => i18n.changeLanguage('id'));
    expect(screen.getByText('Taruh aplikasi penjual di layar utama')).toBeVisible();
    await act(() => i18n.changeLanguage('en'));
  });

  it('Not now hides it for 7 days, then it comes back', () => {
    const first = show(iphone);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('home-screen-card')).toBeNull();
    first.unmount();
    show(iphone);
    expect(screen.queryByTestId('home-screen-card')).toBeNull();
    const later = Date.now() + 8 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    show(iphone);
    expect(screen.getByTestId('home-screen-card')).toBeVisible();
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    show(iphone);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('home-screen-card')).toBeNull();
  });
});
