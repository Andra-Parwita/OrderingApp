import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { UpdateBar } from './UpdateBar';
import { registerUpdateI18n } from './i18n/register';
import { CHECK_GAP_MS, reloadOnPreloadError } from './updateCheck';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerUpdateI18n();
  await i18n.changeLanguage('en');
});

const answer = (version: string) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify({ version }))));

async function mount(
  fetchImpl: typeof fetch,
  extra: { now?: () => number; enabled?: boolean } = {},
) {
  const watch = { current: '1.0.1', enabled: true, fetchImpl, ...extra };
  render(
    <AppThemeProvider>
      <UpdateBar watch={watch} />
    </AppThemeProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('UpdateBar', () => {
  it('shows the bar when the deployed version differs', async () => {
    await mount(answer('1.0.2'));
    expect(screen.getByText(/A new version is ready/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('publishes its height so the offline banner sits below it, and clears it when hidden', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
    await mount(answer('1.0.2'));
    expect(document.documentElement.style.getPropertyValue('--update-bar-height')).toBe('36px');
    expect(document.documentElement.style.getPropertyValue('--top-bars')).toBe('36px');
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(document.documentElement.style.getPropertyValue('--update-bar-height')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--top-bars')).toBe('0px');
    height.mockRestore();
  });

  it('shows nothing when the version is the same', async () => {
    await mount(answer('1.0.1'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides on the cross, and comes back at the next check', async () => {
    let time = 0;
    const fetchImpl = answer('1.0.2');
    await mount(fetchImpl, { now: () => time });
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('status')).toBeNull();
    // back to the front within 5 minutes: no new check
    fireEvent(document, new Event('visibilitychange'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    time = CHECK_GAP_MS + 1;
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not fetch when not enabled (dev)', async () => {
    const fetchImpl = answer('1.0.2');
    await mount(fetchImpl, { enabled: false });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows nothing when version.json cannot be read', async () => {
    await mount(vi.fn(() => Promise.reject(new Error('offline'))));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('reloadOnPreloadError', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('reloads once, not twice', () => {
    const reload = vi.fn();
    const stop = reloadOnPreloadError(reload);
    window.dispatchEvent(new Event('vite:preloadError'));
    window.dispatchEvent(new Event('vite:preloadError'));
    stop();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
