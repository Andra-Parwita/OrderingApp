import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { OrderDetailScreen } from './OrderDetailScreen';
import { ReadOnlyOrdersProvider } from './orderAccess';
import { OrdersTableScreen } from './OrdersTableScreen';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

// Plan 028: a helper sees orders read only. They keep "collected" and the sold-out switch.

beforeAll(setupI18n);

const noop = () => undefined;

describe('orders for a helper (read only)', () => {
  it('the order page offers Mark collected only: no steps, lock, nudge, cancel, paid or link', () => {
    const store = createTestStore({ saga: false });
    seed(store, [makeOrder()]);
    renderWithStore(
      <ReadOnlyOrdersProvider value>
        <OrderDetailScreen code="K7F2QX" onBack={noop} />
      </ReadOnlyOrdersProvider>,
      store,
    );
    expect(screen.getByRole('button', { name: 'Mark collected' })).toBeInTheDocument();
    for (const name of [
      'Mark ready for pickup',
      'Cancel order',
      'Mark paid',
      'Lock',
      'Nudge',
      'Send link on WhatsApp',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  function renderTable() {
    const store = createTestStore({ saga: false });
    seed(store, [makeOrder({ id: '1', code: 'AAA222', firstName: 'Rina' })]);
    seedMenu(store, makeMenuView('live'));
    renderWithStore(
      <ReadOnlyOrdersProvider value>
        <OrdersTableScreen
          filter="all"
          query=""
          onFilterChange={noop}
          onQueryChange={noop}
          onOpenOrder={noop}
          selectedCode="AAA222"
          toggles={{ changed: false, unpaid: false }}
          onToggle={noop}
          onCloseOrder={noop}
          onCloseNewOrder={noop}
        />
      </ReadOnlyOrdersProvider>,
      store,
    );
  }

  it('the order panel has no paid, link or More menu, and the list has no New order or Taking orders', () => {
    renderTable();
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByRole('button', { name: 'Mark collected' })).toBeInTheDocument();
    for (const name of ['Mark paid', 'Send link on WhatsApp', 'More']) {
      expect(within(panel).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /new order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('Dishes keeps the sold-out switch but not Edit limit', () => {
    renderTable();
    const tools = screen.getAllByRole('button', { name: 'More' });
    fireEvent.click(tools[0] as HTMLElement);
    fireEvent.click(screen.getByRole('menuitem', { name: /^Dishes/ }));
    expect(screen.getByRole('button', { name: 'Sold out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit limit/ })).not.toBeInTheDocument();
  });
});
