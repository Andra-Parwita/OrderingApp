import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { lightTheme } from '../../theme/themes';

const resetThisPhone = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('./resetThisPhone', () => ({ resetThisPhone }));

import { StartFreshScreen } from './StartFreshScreen';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

function show(onDone = vi.fn(), onOpenSettings = vi.fn()) {
  render(
    <ThemeProvider theme={lightTheme}>
      <StartFreshScreen onBack={vi.fn()} onOpenSettings={onOpenSettings} onDone={onDone} />
    </ThemeProvider>,
  );
  return { onDone, onOpenSettings };
}

describe('StartFreshScreen', () => {
  it('shows the seven steps in English and in Indonesian', async () => {
    show();
    expect(screen.getByRole('heading', { name: 'Start fresh' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Reset this phone' })).toBeVisible();
    // Plan 122: the last step, for the iPhone start screen.
    expect(screen.getAllByRole('listitem')[6]).toHaveTextContent(
      'To get the new start screen on iPhone: remove the app, open the kitchen link in Safari, pull down to refresh, then Add to Home Screen.',
    );
    await i18n.changeLanguage('id');
    expect(screen.getByRole('heading', { name: 'Mulai dari awal' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Atur ulang HP ini' })).toBeVisible();
    expect(screen.getAllByRole('listitem')[6]).toHaveTextContent(
      'Untuk tampilan pembuka yang baru di iPhone: hapus aplikasinya, buka tautan dapur di Safari, tarik ke bawah untuk memuat ulang, lalu Tambahkan ke Layar Utama.',
    );
    await i18n.changeLanguage('en');
  });

  it('Reset this phone resets once, then returns to the start', async () => {
    const { onDone } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Reset this phone' }));
    expect(screen.getByRole('button', { name: 'Resetting…' })).toBeDisabled();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(resetThisPhone).toHaveBeenCalledTimes(1);
  });

  it('links to Delete my saved data in Settings', () => {
    const { onOpenSettings } = show();
    fireEvent.click(screen.getByRole('button', { name: /Delete my saved data/ }));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
