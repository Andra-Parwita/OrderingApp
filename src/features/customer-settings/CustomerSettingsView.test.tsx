import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { registerInstallI18n, type Environment } from '../../components/install';
import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { lightTheme } from '../../theme/themes';
import { CustomerSettingsView, type CustomerSettingsViewProps } from './CustomerSettingsView';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
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

function show(extra: Partial<CustomerSettingsViewProps> = {}, onLang = vi.fn(), onTheme = vi.fn()) {
  render(
    <ThemeProvider theme={lightTheme}>
      <CustomerSettingsView
        lang="en"
        onLang={onLang}
        theme="auto"
        onTheme={onTheme}
        install={{ env: base }}
        {...extra}
      />
    </ThemeProvider>,
  );
  return { onLang, onTheme };
}

describe('CustomerSettingsView', () => {
  it('changes the language and the appearance', () => {
    const { onLang, onTheme } = show();
    fireEvent.click(screen.getByRole('radio', { name: 'ID' }));
    expect(onLang).toHaveBeenCalledWith('id');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onTheme).toHaveBeenCalledWith('dark');
    expect(screen.getByText('Auto · follows phone')).toBeVisible();
  });

  it('shows Order updates On when subscribed, and a tap on the switch turns it off', () => {
    show({ install: { env: { ...base, permission: 'granted' }, subscribed: true } });
    const updates = screen.getByRole('switch', { name: 'Order updates' });
    expect(updates).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('On')).toBeVisible();
  });

  it('shows Off, and says when the phone has them blocked', () => {
    show({ install: { env: { ...base, permission: 'denied' } } });
    expect(screen.getByRole('switch', { name: 'Order updates' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText("Blocked in your phone's settings")).toBeVisible();
  });

  it('disables the switch where the browser cannot get notifications', () => {
    show({ install: { env: { ...base, platform: 'desktop', pushSupported: false } } });
    expect(screen.getByRole('switch', { name: 'Order updates' })).toBeDisabled();
  });

  it('offers Install on Android when the browser does, and the Chrome fallback text', () => {
    show({ canInstall: true });
    expect(screen.getByRole('button', { name: 'Install' })).toBeVisible();
    expect(screen.getByText(/No Install button\?/)).toBeVisible();
  });

  it('opens the guide from the home-screen card on an iPhone', () => {
    show({
      install: {
        env: { ...base, platform: 'ios', safari: true, pushSupported: false },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Step 1 of 4')).toBeVisible();
  });

  it('hides the home-screen card once the app is installed', () => {
    show({ install: { env: { ...base, installed: true } }, canInstall: false });
    expect(screen.queryByText('Put it on your home screen')).toBeNull();
  });
});
