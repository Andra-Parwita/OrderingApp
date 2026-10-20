import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { registerInstallI18n, type Environment } from '../../components/install';
import { registerRememberMeI18n } from '../../components/remember-me';
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
  registerRememberMeI18n();
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
  it('shows Language, Appearance and Text size as value rows with the value in their name', () => {
    show();
    expect(screen.getByRole('button', { name: 'Language English' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Appearance Auto' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Text size Normal' })).toBeVisible();
  });

  it('changes the language from the picker sheet and closes it', () => {
    const { onLang } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Language English' }));
    expect(screen.getByRole('dialog', { name: 'Language' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Bahasa Indonesia' }));
    expect(onLang).toHaveBeenCalledWith('id');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('changes the appearance from the picker; Auto says it follows the phone', () => {
    const { onTheme } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Appearance Auto' }));
    expect(screen.getByRole('radio', { name: /Auto/ })).toBeChecked();
    expect(screen.getByText('Follows phone')).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onTheme).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closing the picker with Close changes nothing', () => {
    const { onLang } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Language English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLang).not.toHaveBeenCalled();
  });

  it('hides the language row when the kitchen offers one language (plan 056)', () => {
    show({ showLanguage: false });
    expect(screen.queryByRole('button', { name: /^Language/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Appearance Auto' })).toBeInTheDocument();
  });

  it('shows the kitchen banner on top when a kitchen is loaded, nothing without', () => {
    const kitchen = {
      sellerId: 's1',
      name: 'Onde Onde',
      tagline: { en: 'x', id: 'x' },
      bannerImageUrl: '/banner.png',
    };
    const first = render(
      <ThemeProvider theme={lightTheme}>
        <CustomerSettingsView
          lang="en"
          onLang={vi.fn()}
          theme="auto"
          onTheme={vi.fn()}
          install={{ env: base }}
          kitchen={kitchen}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'Onde Onde banner' })).toBeInTheDocument();
    first.unmount();
    show();
    expect(screen.queryByRole('img', { name: 'Onde Onde banner' })).toBeNull();
  });

  it('picks a text size and applies it to the page', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Text size Normal' }));
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Larger' }));
    expect(document.documentElement.style.fontSize).toBe('112.5%');
    fireEvent.click(screen.getByRole('button', { name: 'Text size Larger' }));
    expect(screen.getByRole('radio', { name: 'Larger' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
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

  it('opens About and privacy in English and in Indonesian', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /Read/ }));
    expect(screen.getByRole('dialog', { name: 'How we keep your data private' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your address' })).toBeVisible();
    expect(screen.getByText(/only the kitchen.s team can see it/i)).toBeVisible();
    expect(screen.getByText(/locked with your passkey/)).toBeVisible();
    expect(screen.getByText(/4 weeks after the cooking day/)).toBeVisible();
    expect(screen.getByText('Version 1.0.43')).toBeVisible();
    await i18n.changeLanguage('id');
    expect(screen.getByText(/hanya tim dapur yang bisa melihatnya/i)).toBeVisible();
    expect(screen.getByText('Versi 1.0.43')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Cara kami menjaga datamu' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Alamat Anda' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Tutup/ }));
    expect(screen.queryByText(/hanya tim dapur yang bisa melihatnya/i)).toBeNull();
    await i18n.changeLanguage('en');
  });

  it('hides the home-screen card once the app is installed', () => {
    show({ install: { env: { ...base, installed: true } }, canInstall: false });
    expect(screen.queryByText('Put it on your home screen')).toBeNull();
  });
});
