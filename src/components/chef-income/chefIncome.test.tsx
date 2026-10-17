import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import type { ChefSummaryResponse } from '../../../shared/chefSummaryContract';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { IncomeAccessProvider } from './access';
import { ChefIncomeButton } from './ChefIncome';
import { ChefIncomeSetting } from './ChefIncomeSetting';

const SUMMARY: ChefSummaryResponse = {
  menuId: 'm1',
  cookingDate: '2026-10-17',
  rows: [
    {
      chefId: 'dewi',
      name: 'Chef Dewi',
      portions: 3,
      preOrderCents: 1500,
      stallCents: 3000,
      incomeCents: 4500,
    },
    {
      chefId: 'wati',
      name: 'Chef Wati',
      portions: 2,
      preOrderCents: 2000,
      stallCents: 0,
      incomeCents: 2000,
    },
    { chefId: null, portions: 1, preOrderCents: 1500, stallCents: 0, incomeCents: 1500 },
  ],
  totalPortions: 6,
  totalCents: 8000,
};

function prefs(chefsSeeIncome: boolean) {
  return http.get('*/api/seller/preferences', () =>
    HttpResponse.json({
      preferences: {
        theme: 'onde',
        chefsSeeIncome,
        menuDefaults: {
          cutoffDaysBefore: 1,
          cutoffTime: '21:00',
          delivery: { available: false, note: { en: '', id: '' } },
        },
      },
    }),
  );
}

function show(role: 'seller' | 'chef' | 'helper', chefId?: string) {
  return render(
    <AppThemeProvider>
      <IncomeAccessProvider role={role} chefId={chefId}>
        <ChefIncomeButton menuId="current" />
      </IncomeAccessProvider>
    </AppThemeProvider>,
  );
}

describe('per-chef income (plan 069)', () => {
  beforeAll(async () => {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList;
    if (!i18n.isInitialized) await initI18n();
    await i18n.changeLanguage('en');
  });

  it('the owner gets "Per chef" and the panel lists every chef, whole kitchen last, and a total', async () => {
    await mockStore.reset();
    server.use(
      http.get('*/api/seller/menus/current/chef-summary', () => HttpResponse.json(SUMMARY)),
    );
    show('seller');
    fireEvent.click(screen.getByRole('button', { name: 'Per chef' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Chef Dewi');
    const rows = within(dialog).getAllByRole('row');
    // header + 3 chefs + total
    expect(rows).toHaveLength(5);
    expect(rows[1]).toHaveTextContent('Chef Dewi');
    expect(rows[1]).toHaveTextContent('$45.00');
    expect(rows[3]).toHaveTextContent('Whole kitchen');
    expect(rows[4]).toHaveTextContent('Total');
    expect(rows[4]).toHaveTextContent('6');
    expect(rows[4]).toHaveTextContent('$80.00');
  });

  it('a chef gets "My income" only while the kitchen setting is on', async () => {
    await mockStore.reset();
    server.use(prefs(true));
    const on = show('chef');
    expect(await screen.findByRole('button', { name: 'My income' })).toBeInTheDocument();
    on.unmount();
    server.use(prefs(false));
    show('chef');
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });

  it('a helper never gets the button', async () => {
    await mockStore.reset();
    show('helper');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a menu without kept chefs says so, and a refusal says so', async () => {
    await mockStore.reset();
    server.use(
      http.get('*/api/seller/menus/current/chef-summary', () =>
        HttpResponse.json({ error: 'not_found', message: 'x' }, { status: 404 }),
      ),
    );
    show('seller');
    fireEvent.click(screen.getByRole('button', { name: 'Per chef' }));
    expect(await screen.findByText(/latest menu only/)).toBeInTheDocument();
  });

  it('the owner switches the setting off with one preferences call', async () => {
    await mockStore.reset();
    let sent: unknown = null;
    server.use(
      prefs(true),
      http.put('*/api/seller/preferences', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          preferences: {
            theme: 'onde',
            chefsSeeIncome: false,
            menuDefaults: {
              cutoffDaysBefore: 1,
              cutoffTime: '21:00',
              delivery: { available: false, note: { en: '', id: '' } },
            },
          },
        });
      }),
    );
    render(
      <AppThemeProvider>
        <ChefIncomeSetting />
      </AppThemeProvider>,
    );
    const box = await screen.findByRole('checkbox', { name: /Chefs can see their own income/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    await waitFor(() => expect(sent).toEqual({ chefsSeeIncome: false }));
    expect(box).not.toBeChecked();
  });

  describe('the private block (plan 081)', () => {
    function privateToday() {
      return [
        http.get('*/api/seller/menus/current/chef-summary', () => HttpResponse.json(SUMMARY)),
        http.get('*/api/seller/private', () =>
          HttpResponse.json({ orders: [], due: { today: 0, tomorrow: 0 }, today: '2026-10-17' }),
        ),
        http.get('*/api/seller/private/chef-summary', () =>
          HttpResponse.json({
            date: '2026-10-17',
            rows: [
              { chefId: 'dewi', chefName: 'Chef Dewi', qty: 4, cents: 6000 },
              { chefId: 'wati', chefName: 'Chef Wati', qty: 2, cents: 2400 },
            ],
          }),
        ),
      ];
    }

    it('the owner sees every chef of the day under "Private · date"', async () => {
      await mockStore.reset();
      server.use(...privateToday());
      show('seller');
      fireEvent.click(screen.getByRole('button', { name: 'Per chef' }));
      const block = await screen.findByRole('region', { name: /^Private · / });
      expect(within(block).getAllByRole('row')).toHaveLength(4); // header, 2 chefs, total
      expect(block).toHaveTextContent('$84.00');
    });

    it('a chef sees only her own row', async () => {
      await mockStore.reset();
      server.use(prefs(true), ...privateToday());
      show('chef', 'wati');
      fireEvent.click(await screen.findByRole('button', { name: 'My income' }));
      const block = await screen.findByRole('region', { name: /^Private · / });
      expect(block).toHaveTextContent('Chef Wati');
      expect(block).not.toHaveTextContent('Chef Dewi');
    });
  });
});
