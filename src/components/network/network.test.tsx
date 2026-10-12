import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { recordOutcome, resetNetState, setPollsStopped } from '../../api/netState';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { OfflineBanner } from './OfflineBanner';
import { registerNetworkI18n } from './i18n/register';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerNetworkI18n();
});

let online = true;
beforeEach(async () => {
  online = true;
  resetNetState();
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  await i18n.changeLanguage('en');
});
afterEach(() => {
  vi.restoreAllMocks();
});

const mount = (onTryAgain = () => undefined) =>
  render(
    <AppThemeProvider>
      <OfflineBanner onTryAgain={onTryAgain} />
    </AppThemeProvider>,
  );

describe('OfflineBanner', () => {
  it('shows nothing while all is well', () => {
    mount();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the offline text, then hides when the connection is back', () => {
    mount();
    act(() => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent("You're offline. Your changes are kept.");
    act(() => {
      online = true;
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the server text after a failed call and hides when a call works', () => {
    mount();
    act(() => recordOutcome('GET', 503));
    expect(screen.getByRole('status')).toHaveTextContent("Server isn't answering");
    act(() => recordOutcome('GET', 200));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the stopped text with Try again', () => {
    const again = vi.fn();
    mount(again);
    act(() => setPollsStopped(true));
    expect(screen.getByRole('status')).toHaveTextContent("Can't reach the kitchen right now.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    mount();
    act(() => recordOutcome('GET', 500));
    expect(screen.getByRole('status')).toHaveTextContent('Server belum menjawab');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
    act(() => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Kamu sedang offline');
  });
});
