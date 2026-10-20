import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { updateItem } from '../../api/client';
import { fetchDayLog } from '../../api/day';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerSaturdayI18n } from './i18n/register';
import { SellScreen, UNDO_MS } from './SellScreen';

// Plan 029 stages 4-5: the Sell screen and the end-of-day summary, against the real Worker routes.

function renderSell(canCorrect = false) {
  return render(
    <AppThemeProvider>
      <SellScreen canCorrect={canCorrect} />
    </AppThemeProvider>,
  );
}

async function stockUp(itemId: string, dayStock: number) {
  const result = await updateItem(itemId, { dayStock }, undefined, DEFAULT_SELLER_SLUG);
  if (!result.ok) throw new Error('could not set the day stock');
}

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
});
afterEach(() => vi.useRealTimers());

describe('Sell screen', () => {
  it('shows the on-the-day dishes with their stock and sells one with -1', async () => {
    await stockUp('pesmol', 3);
    renderSell();
    const pesmol = await screen.findByTestId('sell-pesmol');
    expect(within(pesmol).getByLabelText('Tilapia pesmol: portions left')).toHaveTextContent('3');
    expect(screen.queryByTestId('sell-lemper')).toBeNull(); // not sold on the day
    fireEvent.click(within(pesmol).getByRole('button', { name: 'Sell one Tilapia pesmol' }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
      ).toHaveTextContent('2'),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Sold 1 × Tilapia pesmol');
  });

  it('plan 114: -1 waits while its sale is on the way, so a double tap sells once', async () => {
    await stockUp('pesmol', 5);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sales = 0;
    server.use(
      http.post('*/api/seller/day/sale', async () => {
        sales += 1;
        await gate;
        return undefined;
      }),
    );
    renderSell();
    const minus = await screen.findByRole('button', { name: 'Sell one Tilapia pesmol' });
    fireEvent.click(minus);
    fireEvent.click(minus);
    await waitFor(() => expect(minus).toBeDisabled());
    release();
    await waitFor(() => expect(minus).toBeEnabled());
    expect(sales).toBe(1);
    expect(
      within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
    ).toHaveTextContent('4');
  });

  it('Undo within the window gives the portion back; the bar goes after 5 seconds', async () => {
    await stockUp('pesmol', 3);
    renderSell();
    fireEvent.click(await screen.findByRole('button', { name: 'Sell one Tilapia pesmol' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
      ).toHaveTextContent('3'),
    );
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(async () => {
      const log = await fetchDayLog(DEFAULT_SELLER_SLUG);
      expect(log.ok && log.data.entries.map((e) => [e.kind, e.undone])).toEqual([
        ['undo', false],
        ['sale', true],
      ]);
    });
    // A new sale shows Undo, then it disappears on its own.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: 'Sell one Tilapia pesmol' }));
    await screen.findByRole('status');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sells n, sets the count, and stops -1 at zero (sold out at the stall)', async () => {
    await stockUp('pesmol', 4);
    renderSell();
    const pesmol = await screen.findByTestId('sell-pesmol');
    const number = within(pesmol).getByLabelText('Number');
    fireEvent.change(number, { target: { value: '3' } });
    fireEvent.click(
      within(pesmol).getByRole('button', { name: 'Sell the number of Tilapia pesmol' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
      ).toHaveTextContent('1'),
    );
    fireEvent.change(within(screen.getByTestId('sell-pesmol')).getByLabelText('Number'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set the count of Tilapia pesmol' }));
    await waitFor(() =>
      expect(screen.getByTestId('sell-pesmol')).toHaveTextContent('Sold out at the stall'),
    );
    expect(screen.getByRole('button', { name: 'Sell one Tilapia pesmol' })).toBeDisabled();
  });

  it('the Summary tab shows pre-ordered against sold on the day, per person, the log, and the CSV', async () => {
    await stockUp('pesmol', 5);
    renderSell(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Sell one Tilapia pesmol' }));
    await screen.findByRole('status');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('sell-pesmol')).getByLabelText(/portions left/),
      ).toHaveTextContent('4'),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Summary' }));
    // Plan 074: the log is fetched when Summary opens (the sale on this device was not re-fetched).
    await waitFor(
      () => {
        const row = screen
          .getAllByRole('row')
          .find((r) => r.textContent?.startsWith('Tilapia pesmol'));
        expect(
          within(row as HTMLElement)
            .getAllByRole('cell')
            .map((c) => c.textContent),
        ).toEqual(['Tilapia pesmol', '0', '1', '4']);
      },
      { timeout: 4000 },
    );
    expect(screen.getByText('Sold on the day: 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
    // The owner can correct a log entry later.
    fireEvent.click(screen.getByRole('button', { name: /^Undo: / }));
    await waitFor(() => expect(screen.getByText('Sold on the day: 0')).toBeVisible());
  });
});
