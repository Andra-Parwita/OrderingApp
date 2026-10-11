import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ReadOnlyOrdersProvider } from './orderAccess';
import { OrdersTableScreen } from './OrdersTableScreen';
import { PrintOrdersScreen } from './PrintOrders';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchMenu: () => Promise.resolve({ ok: true, data: { kitchen: { name: 'Dapur Demo' } } }),
}));

beforeAll(setupI18n);

const noop = () => undefined;

function store() {
  const s = createTestStore({ saga: false });
  seed(s, [
    makeOrder({ id: '1', code: 'AAA222', firstName: 'Rina' }),
    makeOrder({ id: '2', code: 'BBB222', firstName: 'Budi', status: 'cancelled' }),
  ]);
  seedMenu(s, makeMenuView('live'));
  return s;
}

describe('print orders screen', () => {
  it('shows the page header and the live orders, not the cancelled one', async () => {
    renderWithStore(<PrintOrdersScreen />, store());
    expect(await screen.findByText('Dapur Demo')).toBeInTheDocument();
    expect(screen.getAllByTestId('print-page')).toHaveLength(1);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText(/^Menu for /)).toBeInTheDocument();
    expect(screen.getByText('Rina')).toBeInTheDocument();
    expect(screen.queryByText('Budi')).not.toBeInTheDocument();
    expect(screen.getByText('Glenelg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  });

  it('a helper gets no print screen', () => {
    renderWithStore(
      <ReadOnlyOrdersProvider value>
        <PrintOrdersScreen />
      </ReadOnlyOrdersProvider>,
      store(),
    );
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('owner and chefs');
  });

  function table(readOnly: boolean) {
    renderWithStore(
      <ReadOnlyOrdersProvider value={readOnly}>
        <OrdersTableScreen
          filter="all"
          query=""
          onFilterChange={noop}
          onQueryChange={noop}
          onOpenOrder={noop}
          onNewOrder={noop}
        />
      </ReadOnlyOrdersProvider>,
      store(),
    );
  }

  it('the Orders header has Print for the owner but not for a helper', () => {
    table(false);
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });
  it('the Orders header has no Print for a helper', () => {
    table(true);
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
  });
});
