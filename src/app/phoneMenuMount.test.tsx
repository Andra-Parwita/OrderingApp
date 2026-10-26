import { screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mayNotify } from './session';
import type { Order } from '../../shared/domain';
import { PhoneOrdersScreen } from '../features/seller-orders';
import {
  createTestStore,
  makeOrder,
  makeMenuView,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from '../features/seller-orders/testSupport';
import { PhoneMenuCard, PhoneMenuProvider, registerSellerMenuI18n } from '../features/seller-menu';

// Plan 124: who gets the card. The app gives `menuCard` to PhoneOrdersScreen only when `mayNotify(me)`
// (the owner), and only the phone layout has the prop (the tablet's OrdersTableScreen does not).

const api = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock('../api/menuNotices', () => ({
  fetchMenuNoticeStatus: api.status,
  sendMenuNotice: vi.fn(),
}));

beforeAll(async () => {
  await setupI18n();
  registerSellerMenuI18n();
});
afterEach(() => api.status.mockReset());

const noop = () => undefined;
const as = (role: string) => ({ role }) as unknown as Parameters<typeof mayNotify>[0];

function renderPhone(owner: boolean, orders: Array<Order> = []) {
  api.status.mockResolvedValue({ ok: false, error: 'forbidden', status: 403, message: '' });
  const store = createTestStore({ saga: false });
  seed(store, orders);
  seedMenu(
    store,
    makeMenuView('live', { cookingDate: '2099-10-31', cutoffAt: '2099-10-30T21:00:00Z' }),
  );
  renderWithStore(
    <PhoneOrdersScreen
      filter="all"
      query=""
      onFilterChange={noop}
      onQueryChange={noop}
      onOpenOrder={noop}
      onNewOrder={noop}
      onShare={noop}
      {...(owner ? { menuCard: { Provider: PhoneMenuProvider, Card: PhoneMenuCard } } : {})}
    />,
    store,
  );
}

describe('Menu card on the phone Orders screen', () => {
  it('the card is inside the list scroller: it scrolls away with the orders', () => {
    renderPhone(true, [makeOrder({ id: '1', code: 'AAA222', firstName: 'Rina' })]);
    const card = screen.getByRole('region', { name: /^Menu for / });
    const scroller = card.parentElement as HTMLElement;
    expect(scroller).toContainElement(screen.getByText('Rina'));
    expect(scroller.parentElement).not.toBe(card.closest('main'));
  });

  it('the owner sees the card above the list, and the empty state no longer has its own Share', () => {
    renderPhone(true);
    expect(screen.getByRole('region', { name: /^Menu for / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Share menu/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Share menu on WhatsApp' }),
    ).not.toBeInTheDocument();
  });

  it('a chef or helper sees what they saw before: no card, the empty state keeps its Share', () => {
    renderPhone(false);
    expect(screen.queryByRole('region', { name: /^Menu for / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share menu on WhatsApp' })).toBeInTheDocument();
  });

  it('the app gives the card only to an owner', () => {
    expect(mayNotify(as('owner'))).toBe(true);
    expect(mayNotify(as('chef'))).toBe(false);
    expect(mayNotify(as('helper'))).toBe(false);
  });
});
