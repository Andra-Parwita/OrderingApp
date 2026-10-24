import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setSessionSeller } from '../../api/device/sellerContext';
import en from '../../i18n/en.json';
import { lightTheme } from '../../theme/themes';
import type { Environment } from './detect';
import { registerInstallI18n } from './i18n/register';
import { setSavedInstallPrompt } from './installPrompt';
import { useSellerInstall } from './useSellerInstall';

vi.mock('../../api/client', async (original) => ({
  ...(await original<typeof import('../../api/client')>()),
  fetchMenu: vi.fn(() => Promise.resolve({ ok: true, data: { kitchen: { name: 'Onde Onde' } } })),
}));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
});
afterEach(() => {
  setSavedInstallPrompt(null);
  setSessionSeller(null);
  window.history.replaceState(null, '', '/');
});

const base: Environment = {
  platform: 'android',
  inApp: false,
  inAppName: null,
  safari: false,
  installed: false,
  pushSupported: true,
  permission: 'default',
};
const iphone: Environment = { ...base, platform: 'ios', safari: true };

function Row({ env }: Readonly<{ env: Environment }>) {
  const install = useSellerInstall({ env });
  return (
    <>
      {install.available ? <button onClick={install.install}>{install.title}</button> : null}
      {install.overlay}
    </>
  );
}
const show = (env: Environment) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <Row env={env} />
    </ThemeProvider>,
  );

describe('the seller "Install the app" row (plan 048)', () => {
  it('shows on Android when Chrome offers the install, and a tap opens its dialog', () => {
    const prompt = vi.fn(() => Promise.resolve());
    show(base);
    expect(screen.queryByText('Install the app')).toBeNull();
    act(() =>
      setSavedInstallPrompt(
        Object.assign(new Event('beforeinstallprompt'), {
          prompt,
          userChoice: Promise.resolve({ outcome: 'accepted' as const }),
        }),
      ),
    );
    fireEvent.click(screen.getByText('Install the app'));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('is hidden when already installed, on iPhone too', () => {
    show({ ...iphone, installed: true });
    expect(screen.queryByText('Install the app')).toBeNull();
  });

  it('opens the Share → Add to Home Screen steps on iPhone', () => {
    show(iphone);
    fireEvent.click(screen.getByText('Install the app'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Step 1 of/)).toBeTruthy();
  });

  it("names the kitchen: Install Onde Onde's seller app (plan 101)", async () => {
    setSessionSeller('onde-onde');
    show(iphone);
    expect(await screen.findByText("Install Onde Onde's seller app")).toBeTruthy();
    expect(screen.queryByText('Install the app')).toBeNull();
  });

  it('stays hidden when the kitchen app is installed or running standalone', async () => {
    setSessionSeller('onde-onde');
    show({ ...base, installed: true });
    await Promise.resolve();
    expect(screen.queryByText(/Install/)).toBeNull();
  });

  it('on iPhone, the address carries ?k=<slug> while the steps are open', async () => {
    setSessionSeller('onde-onde');
    window.history.replaceState(null, '', '/seller/more');
    show(iphone);
    fireEvent.click(await screen.findByText("Install Onde Onde's seller app"));
    expect(window.location.pathname + window.location.search).toBe('/seller/more?k=onde-onde');
  });

  it('does not touch the address on Android', async () => {
    setSessionSeller('onde-onde');
    window.history.replaceState(null, '', '/seller/more');
    show(base);
    await Promise.resolve();
    expect(window.location.search).toBe('');
  });
});
