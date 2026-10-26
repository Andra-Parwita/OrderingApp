import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { UpdateBar } from './UpdateBar';
import { registerUpdateI18n } from './i18n/register';
import {
  CHECK_GAP_MS,
  checkForUpdateNow,
  reloadOnPreloadError,
  watchForUpdate,
} from './updateCheck';

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
  extra: { now?: () => number; enabled?: boolean; reload?: () => void } = {},
) {
  const { reload, ...rest } = extra;
  const watch = { current: '1.0.1', enabled: true, fetchImpl, ...rest };
  render(
    <AppThemeProvider>
      <UpdateBar watch={watch} reload={reload} />
    </AppThemeProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('UpdateBar', () => {
  beforeEach(() => localStorage.clear());

  it('shows the bar when the deployed version differs', async () => {
    await mount(answer('1.0.2'));
    expect(screen.getByText(/A new version is ready/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'A new version is ready. Refresh' }),
    ).toBeInTheDocument();
  });

  it('is one pill: icon, text and a Refresh link; the whole bar refreshes, the cross only hides', async () => {
    const reload = vi.fn();
    await mount(answer('1.0.2'), { reload });
    const bar = screen.getByRole('button', { name: 'A new version is ready. Refresh' });
    expect(bar.querySelector('img')).toHaveAttribute('src', '/brand/logo-icon.webp');
    expect(bar).toHaveTextContent('A new version is ready');
    expect(bar).toHaveTextContent('Refresh');
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('refreshes when the bar is tapped', async () => {
    const reload = vi.fn();
    await mount(answer('1.0.2'), { reload });
    fireEvent.click(screen.getByText('A new version is ready'));
    expect(reload).toHaveBeenCalledTimes(1);
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
    // back to the front within 10 minutes: no new check
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

  describe('gap and saved check time (plan 125)', () => {
    afterEach(() => vi.restoreAllMocks());
    const settle = () =>
      act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    const watcher = (fetchImpl: typeof fetch, now?: () => number) => () =>
      watchForUpdate(() => undefined, {
        current: '1.0.1',
        enabled: true,
        fetchImpl,
        ...(now ? { now } : {}),
      });

    it('does not fetch again within 10 minutes across a remount, and fetches after 10 minutes', async () => {
      let time = 1_000;
      const fetchImpl = answer('1.0.1');
      const start = watcher(fetchImpl, () => time);
      start()();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      time += CHECK_GAP_MS - 1;
      const stop = start(); // a reload within the gap
      fireEvent(document, new Event('visibilitychange'));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      stop();
      time += 1;
      start();
      await settle();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('still works when storage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      let time = Date.now() + 100 * CHECK_GAP_MS; // later than any time memory kept from other tests
      const fetchImpl = answer('1.0.1');
      const start = watcher(fetchImpl, () => time);
      start()();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      start()();
      expect(fetchImpl).toHaveBeenCalledTimes(1); // remembered in memory
      time += CHECK_GAP_MS;
      start()();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('sets no timer', () => {
      const interval = vi.spyOn(globalThis, 'setInterval');
      watcher(answer('1.0.1'))()();
      expect(interval).not.toHaveBeenCalled();
    });
  });

  describe('checkForUpdateNow', () => {
    it('ignores the gap and says newer, same or error', async () => {
      const current = '1.0.1';
      await expect(checkForUpdateNow({ current, fetchImpl: answer('1.0.2') })).resolves.toBe(
        'newer',
      );
      await expect(checkForUpdateNow({ current, fetchImpl: answer('1.0.1') })).resolves.toBe(
        'same',
      );
      await expect(
        checkForUpdateNow({ current, fetchImpl: vi.fn(() => Promise.reject(new Error('x'))) }),
      ).resolves.toBe('error');
    });
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

  afterEach(() => Reflect.deleteProperty(window, 'caches'));

  it('reloads once, not twice, without caches', async () => {
    const reload = vi.fn();
    const stop = reloadOnPreloadError(reload);
    window.dispatchEvent(new Event('vite:preloadError'));
    window.dispatchEvent(new Event('vite:preloadError'));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    stop();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('deletes the saved pages (shell-*) only, then reloads once', async () => {
    const del = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: () => Promise.resolve(['shell-v3', 'data-v3']), delete: del },
    });
    const reload = vi.fn();
    const stop = reloadOnPreloadError(reload);
    window.dispatchEvent(new Event('vite:preloadError'));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('shell-v3');
    window.dispatchEvent(new Event('vite:preloadError'));
    await new Promise((r) => setTimeout(r, 10));
    stop();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the cache delete fails', async () => {
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: () => Promise.reject(new Error('nope')), delete: vi.fn() },
    });
    const reload = vi.fn();
    const stop = reloadOnPreloadError(reload);
    window.dispatchEvent(new Event('vite:preloadError'));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    stop();
  });
});
