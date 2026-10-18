import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaintenanceState, StatusResponse } from '../../../shared/maintenance';
import { setMaintenanceBlocked } from '../../api/maintenanceState';
import { recordOutcome, resetNetState } from '../../api/netState';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { OfflineBanner } from '../network/OfflineBanner';
import { registerNetworkI18n } from '../network/i18n/register';
import { MaintenanceHost, SCREEN_POLL_MS } from './MaintenanceHost';
import { registerMaintenanceI18n } from './i18n/register';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerMaintenanceI18n();
  registerNetworkI18n();
});
beforeEach(async () => {
  vi.useFakeTimers();
  resetNetState();
  setMaintenanceBlocked(false);
  await i18n.changeLanguage('en');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.style.removeProperty('--notice-bar-height');
  document.documentElement.style.removeProperty('--top-bars');
});

const FROM = '2026-10-11T12:00:00.000Z';
const UNTIL = '2026-10-11T12:15:00.000Z';
const notice = { from: FROM, until: UNTIL, noteEn: 'Database upgrade', noteId: 'Peningkatan' };

let current: MaintenanceState = { maintenance: false, notice: null };
const fetchImpl = vi.fn(() =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        ...current,
        time: '2026-10-11T00:00:00.000Z',
        backupMinutes: { customer: 5, seller: 5 },
      } satisfies StatusResponse),
    ),
  ),
) as unknown as typeof fetch;

async function mount(now = Date.parse('2026-10-10T12:00:00.000Z'), pathname = '/') {
  render(
    <AppThemeProvider>
      <MaintenanceHost fetchImpl={fetchImpl} now={() => now} pathname={() => pathname} />
    </AppThemeProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('MaintenanceHost', () => {
  it('shows nothing when nothing is announced', async () => {
    current = { maintenance: false, notice: null };
    await mount();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the quiet bar with the note until the window ends, and can be dismissed', async () => {
    current = { maintenance: false, notice };
    await mount();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Maintenance on .*–.*\. The app pauses briefly\. Database upgrade/,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    // Bobo on the left, then one line of text in an amber pill (plan 095).
    const bar = screen.getByRole('status');
    const icon = bar.querySelector('img');
    expect(icon).toHaveAttribute('src', '/brand/logo-icon.webp');
    expect(icon).toHaveAttribute('alt', '');
    expect(bar.querySelector('img + span')).toHaveTextContent(/Maintenance on/);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('--top-bars is 0 with no bar', async () => {
    current = { maintenance: false, notice: null };
    await mount();
    expect(['', '0px']).toContain(document.documentElement.style.getPropertyValue('--top-bars'));
  });

  it('hides the bar once the window is over', async () => {
    current = { maintenance: false, notice };
    await mount(Date.parse(UNTIL) + 1000);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the Indonesian text when the app is Indonesian', async () => {
    await i18n.changeLanguage('id');
    current = { maintenance: false, notice };
    await mount();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Pemeliharaan pada .*Aplikasi berhenti sebentar\. Peningkatan/,
    );
  });

  it('stacks with the offline banner: the notice publishes its height and the banner sits below it', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
    current = { maintenance: false, notice };
    await mount();
    expect(document.documentElement.style.getPropertyValue('--notice-bar-height')).toBe('30px');
    render(
      <AppThemeProvider>
        <OfflineBanner />
      </AppThemeProvider>,
    );
    act(() => recordOutcome('GET', 500));
    const banner = screen
      .getAllByRole('status')
      .find((element) => /answering/.test(element.textContent ?? ''));
    expect(banner).toBeDefined();
    const rules = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('');
    expect(rules).toContain('var(--update-bar-height, 0rem) + var(--notice-bar-height, 0rem)');
    // --top-bars is the sum of the bars showing (plan 080), and returns to 0 after the cross.
    const topBars = () => document.documentElement.style.getPropertyValue('--top-bars');
    expect(topBars()).toBe('60px');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(topBars()).toBe('30px');
    act(() => recordOutcome('GET', 200));
    expect(topBars()).toBe('0px');
  });

  it('shows the Updating screen while maintenance is on, then returns by itself', async () => {
    current = { maintenance: true, notice };
    await mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Updating, back in a few minutes');
    expect(screen.queryByRole('status')).toBeNull();
    current = { maintenance: false, notice: null };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCREEN_POLL_MS + 10);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the screen after a refused call and clears it when the status is back', async () => {
    current = { maintenance: false, notice: null };
    await mount();
    current = { maintenance: true, notice: null };
    await act(async () => {
      setMaintenanceBlocked(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    current = { maintenance: false, notice: null };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCREEN_POLL_MS + 10);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('never covers the admin page', async () => {
    current = { maintenance: true, notice: null };
    await mount(Date.now(), '/admin');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
