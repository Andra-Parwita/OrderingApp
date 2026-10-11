import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { FinishedHome } from './HomeStates';
import { createTestStore, makeMenuView, renderWithStore, seedMenu, setupI18n } from './testSupport';

describe('FinishedHome with no live orders loaded', () => {
  beforeAll(setupI18n);

  it('does not claim "0 orders" unpaid when the unpaid money comes from the finished menu', () => {
    const store = createTestStore({ saga: false });
    seedMenu(store, makeMenuView('finished'), [
      {
        id: 'w1',
        cookingDate: '2026-10-17',
        closedAt: '2026-10-18T00:00:00Z',
        hasOrders: false,
        totals: {
          orders: 3,
          cancelled: 0,
          incomeCents: 112000,
          paidCents: 0,
          unpaidCents: 112000,
          items: [],
        },
      },
    ]);
    renderWithStore(
      <FinishedHome
        view={makeMenuView('finished')}
        showAll={false}
        onToggleAll={() => undefined}
        phone={false}
      />,
      store,
    );
    expect(screen.getAllByText('$1,120.00').length).toBeGreaterThan(0);
    expect(screen.queryByText(/not paid · 0 orders/)).not.toBeInTheDocument();
  });
});
