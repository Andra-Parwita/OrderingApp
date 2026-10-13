import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import type { LiveEventType } from '../../../shared/liveContract';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { updateItem } from '../../api/client';
import { sellerDeviceId } from '../../api/deviceId';
import type { LiveListener } from '../../api/live';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { HandOverScreen } from './HandOverScreen';
import { registerSellerSaturdayI18n } from './i18n/register';
import { SellScreen } from './SellScreen';

// Plan 074: Sell and Hand over have no timer. Connected, they ask for nothing; a sale on this
// device is one request; an event from elsewhere reloads only what it names.

let listener: LiveListener | null = null;
vi.mock('../../api/live', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/live')>()),
  subscribeLive: (next: LiveListener) => {
    listener = next;
    return () => {
      listener = null;
    };
  },
}));

const event = (type: LiveEventType, from?: string) =>
  act(() => {
    listener?.onEvent({ type, ...(from ? { from } : {}), at: '2026-10-14T08:00:00.000Z' });
  });

let requests: Array<string> = [];
// The same request can be announced twice to a listener: count each id once.
const counted = new Set<string>();
const seen = ({ request, requestId }: { request: Request; requestId: string }) => {
  const url = new URL(request.url);
  if (counted.has(requestId)) return;
  counted.add(requestId);
  if (url.pathname.startsWith('/api/')) requests.push(`${request.method} ${url.pathname}`);
};

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerSaturdayI18n();
});
beforeEach(async () => {
  await mockStore.reset();
  localStorage.clear();
  await i18n.changeLanguage('en');
  requests = [];
  server.events.on('request:start', seen);
});
afterEach(() => {
  server.events.removeListener('request:start', seen);
  vi.useRealTimers();
});

const renderThemed = (ui: React.ReactNode) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

async function stockUp(itemId: string, dayStock: number) {
  const result = await updateItem(itemId, { dayStock }, undefined, DEFAULT_SELLER_SLUG);
  if (!result.ok) throw new Error('could not set the day stock');
}
const has = (part: string) => requests.some((r) => r.includes(part));

describe('Sell on the live connection', () => {
  it('open 10 minutes while connected: no polling request at all', async () => {
    await stockUp('pesmol', 3);
    renderThemed(<SellScreen />);
    await screen.findByTestId('sell-pesmol');
    act(() => listener?.onStatus('live'));
    requests = [];
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(requests).toEqual([]);
  });

  it('one sale is one request: the answer updates the screen and the echo is ignored', async () => {
    await stockUp('pesmol', 3);
    renderThemed(<SellScreen />);
    const card = await screen.findByTestId('sell-pesmol');
    act(() => listener?.onStatus('live'));
    requests = [];
    fireEvent.click(within(card).getByRole('button', { name: 'Sell one Tilapia pesmol' }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
      ).toHaveTextContent('2'),
    );
    event('stock.changed', sellerDeviceId()); // the echo of this very sale
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(requests).toEqual(['POST /api/seller/day/sale']);
  });

  it('two devices: A sells, B sells 1 s later: A ignores its own echo and reloads for B’s', async () => {
    await stockUp('pesmol', 3);
    renderThemed(<SellScreen />);
    const card = await screen.findByTestId('sell-pesmol');
    act(() => listener?.onStatus('live'));
    requests = [];
    fireEvent.click(within(card).getByRole('button', { name: 'Sell one Tilapia pesmol' }));
    await waitFor(() => expect(requests).toEqual(['POST /api/seller/day/sale']));
    event('stock.changed', sellerDeviceId()); // A's echo
    await stockUp('pesmol', 1); // B's sale, 1 s later
    event('stock.changed', 'bbbbbbbbbbbbbbbb');
    await waitFor(() => expect(has('/seller/menu')).toBe(true));
    expect(requests.filter((r) => r.includes('/seller/menu'))).toHaveLength(1);
  });

  it('a sale on another device reloads the stock only (not the orders)', async () => {
    await stockUp('pesmol', 3);
    renderThemed(<SellScreen />);
    await screen.findByTestId('sell-pesmol');
    act(() => listener?.onStatus('live'));
    requests = [];
    await stockUp('pesmol', 1); // another device
    requests = [];
    event('stock.changed');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
      ).toHaveTextContent('1'),
    );
    expect(has('/seller/menu')).toBe(true);
    expect(has('/orders')).toBe(false);
    expect(has('/day/log')).toBe(false); // only the Summary tab needs it
  });
});

describe('Hand over on the live connection', () => {
  it('open 10 minutes while connected: no polling request; an order event reloads orders and messages, not the menu', async () => {
    renderThemed(<HandOverScreen />);
    await waitFor(() => expect(has('/orders')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 300));
    act(() => listener?.onStatus('live'));
    requests = [];
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(requests).toEqual([]);
    vi.useRealTimers();
    event('order.changed');
    await waitFor(() => expect(has('/orders')).toBe(true));
    expect(has('/menu')).toBe(false);
  });
});
