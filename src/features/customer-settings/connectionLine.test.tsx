import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CustomerLiveState } from '../../api/customerLiveState';
import { registerInstallI18n } from '../../components/install';
import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { lightTheme } from '../../theme/themes';
import { CustomerSettingsView } from './CustomerSettingsView';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
});

function show(lang: 'en' | 'id', connection: CustomerLiveState) {
  void i18n.changeLanguage(lang);
  render(
    <ThemeProvider theme={lightTheme}>
      <CustomerSettingsView
        lang={lang}
        onLang={vi.fn()}
        theme="auto"
        onTheme={vi.fn()}
        connection={connection}
        install={{
          env: {
            platform: 'android',
            inApp: false,
            inAppName: null,
            safari: false,
            installed: true,
            pushSupported: true,
            permission: 'default',
          },
        }}
      />
    </ThemeProvider>,
  );
}

const AT = new Date(2026, 9, 14, 10, 42).getTime();

describe('connection line (plan 074)', () => {
  it('says live in English', () => {
    show('en', { mode: 'live', lastUpdated: AT, minutes: 5 });
    expect(screen.getByText(/Connection: live/)).toHaveTextContent('Connection: live ●');
  });

  it('says live in Indonesian', () => {
    show('id', { mode: 'live', lastUpdated: null, minutes: 5 });
    expect(screen.getByText(/Koneksi: langsung/)).toBeVisible();
  });

  it('shows the last update and the gap on the backup check', () => {
    show('en', { mode: 'backup', lastUpdated: AT, minutes: 5 });
    expect(screen.getByText('Last updated 10:42 · checking every 5 min')).toBeVisible();
  });

  it('shows the backup line in Indonesian', () => {
    show('id', { mode: 'backup', lastUpdated: AT, minutes: 10 });
    expect(screen.getByText('Terakhir diperbarui 10.42 · cek setiap 10 mnt')).toBeVisible();
  });

  it('says there are no active orders', () => {
    show('en', { mode: 'none', lastUpdated: null, minutes: 5 });
    expect(screen.getByText('No active orders')).toBeVisible();
  });

  it('says so in Indonesian when nothing is active', () => {
    show('id', { mode: 'none', lastUpdated: null, minutes: 5 });
    expect(screen.getByText('Tidak ada pesanan aktif')).toBeVisible();
  });
});
