import { render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server';
import type { StatsResponse } from '../../../shared/orderStats';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerAdminI18n } from './i18n/register';
import { StatsPanel } from './StatsPanel';

const week = {
  week: '2026-10-05',
  orders: 8,
  place: { app: 3, browser: 2, inapp: 1, unknown: 2 },
  os: { ios: 4, android: 2, other: 0, unknown: 2 },
  push: { on: 3, off: 3, unknown: 2 },
  remember: { on: 1, off: 4, unknown: 3 },
};
const reply: StatsResponse = {
  kitchens: [
    { sellerId: 's1', name: 'Onde Onde', slug: 'onde-onde', weeks: [week] },
    { sellerId: 's2', name: 'Dapur Demo', slug: 'dapur-demo', weeks: [] },
  ],
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
  registerAdminI18n();
  await i18n.changeLanguage('en');
});

function show() {
  return render(
    <AppThemeProvider>
      <StatsPanel refused={() => 'refused'} />
    </AppThemeProvider>,
  );
}

describe('Statistics card (plan 121 B)', () => {
  it('shows a compact table per kitchen with counts and percentages, never an order', async () => {
    server.use(http.get('*/api/admin/stats', () => HttpResponse.json(reply)));
    show();
    const table = await screen.findByRole('table', { name: 'Statistics for Onde Onde' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      'Week of',
      'App',
      'Browser',
      'WhatsApp',
      'iPhone',
      'Android',
      'Other',
      'Notifications on',
      'Remember me on',
      'Orders',
    ]);
    const cells = within(within(table).getAllByRole('row')[1] as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    // app, browser, WhatsApp, iPhone, Android, other, notifications 3/(3+3), Remember me 1/(1+4), orders
    expect(cells).toEqual(['3', '2', '1', '4', '2', '0', '50%', '20%', '8']);
    expect(within(table).getByRole('rowheader').textContent).toBe('Mon 5 Oct');
    expect(screen.getByText('Dapur Demo')).toBeInTheDocument();
    expect(screen.getByText('No orders in the last 8 weeks.')).toBeInTheDocument();
  });

  it('shows a dash when no phone said, and says so when the call fails', async () => {
    server.use(
      http.get('*/api/admin/stats', () =>
        HttpResponse.json({
          kitchens: [
            {
              sellerId: 's1',
              name: 'Onde Onde',
              slug: 'onde-onde',
              weeks: [
                {
                  ...week,
                  push: { on: 0, off: 0, unknown: 8 },
                  remember: { on: 0, off: 0, unknown: 8 },
                },
              ],
            },
          ],
        }),
      ),
    );
    const view = show();
    const table = await screen.findByRole('table');
    const cells = within(within(table).getAllByRole('row')[1] as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells.slice(6, 8)).toEqual(['–', '–']);
    view.unmount();

    server.use(http.get('*/api/admin/stats', () => HttpResponse.json({ nope: true })));
    show();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
