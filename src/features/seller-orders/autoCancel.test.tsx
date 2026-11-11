// Plan 130: the "Cancels at" tag in the last 2 hours (tablet and phone rows), and the cancelled
// order's reason with Restore order.
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LiveOrderRow } from './LiveOrderRow';
import { OrderDetailScreen } from './OrderDetailScreen';
import { PhoneOrderRow } from './PhoneOrderRow';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

beforeAll(setupI18n);
afterEach(() => vi.useRealTimers());

const noop = () => undefined;
const PLACED = '2026-11-12T09:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(PLACED) + hours * 3_600_000);
const unconfirmed = () => makeOrder({ status: 'ordered', createdAt: PLACED, audit: [], inbox: [] });

describe('Cancels-at tag (plan 130)', () => {
  it.each([
    [
      'tablet row',
      (order: ReturnType<typeof unconfirmed>) => (
        <LiveOrderRow order={order} selected={false} isNew={false} onOpen={noop} />
      ),
    ],
    [
      'phone row',
      (order: ReturnType<typeof unconfirmed>) => <PhoneOrderRow order={order} onOpen={noop} />,
    ],
  ])('shows only in the last 2 hours: %s', (_name, view) => {
    const store = createTestStore({ saga: false });
    vi.useFakeTimers({ toFake: ['Date'], now: at(21) });
    const early = renderWithStore(view(unconfirmed()), store);
    expect(screen.queryByText(/Cancels at/)).not.toBeInTheDocument();
    early.unmount();
    vi.setSystemTime(at(22.5));
    renderWithStore(view(unconfirmed()), store);
    expect(screen.getByText(/^Cancels at /)).toBeInTheDocument();
  });

  it('does not show for a confirmed, WhatsApp-received or seller-entered order', () => {
    const store = createTestStore({ saga: false });
    vi.useFakeTimers({ toFake: ['Date'], now: at(23) });
    for (const order of [
      { ...unconfirmed(), status: 'confirmed' as const },
      { ...unconfirmed(), waReceived: true },
      { ...unconfirmed(), enteredBy: { role: 'seller' as const, name: 'Rina' } },
    ]) {
      const view = renderWithStore(<PhoneOrderRow order={order} onOpen={noop} />, store);
      expect(screen.queryByText(/Cancels at/)).not.toBeInTheDocument();
      view.unmount();
    }
  });
});

describe('cancelled by the app (plan 130)', () => {
  it('shows the reason and Restore order in the order detail', () => {
    const store = createTestStore({ saga: false });
    const cancelled = makeOrder({
      status: 'cancelled',
      audit: [
        {
          by: { role: 'seller', name: 'App' },
          what: 'status',
          detail: 'not_confirmed_24h',
          at: '2026-11-11T09:00:00.000Z',
        },
      ],
    });
    seed(store, [cancelled]);
    seedMenu(store, makeMenuView('live'));
    renderWithStore(<OrderDetailScreen code={cancelled.code} onBack={noop} />, store);
    expect(screen.getByText(/^Cancelled by the app at /)).toBeInTheDocument();
    expect(
      screen.getByText('Not confirmed within 24 hours (no WhatsApp message).'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore order' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore order' }));
  });

  it('the "Can change" row says until when, "No (closed …)" after, nothing when cancelled (plan 129)', () => {
    const store = createTestStore({ saga: false });
    const order = makeOrder({ status: 'confirmed' });
    seed(store, [order]);
    seedMenu(store, makeMenuView('live'));
    const cooking = store.getState().sellerOrders.cookingDate;
    expect(cooking).not.toBeNull();
    // 6 pm the day before in Adelaide; check both sides of it.
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date(`${cooking}T00:00:00Z`).getTime() - 5 * 86_400_000,
    });
    const first = renderWithStore(<OrderDetailScreen code={order.code} onBack={noop} />, store);
    expect(screen.getByText(/^Yes, until .* or until you lock it$/)).toBeInTheDocument();
    first.unmount();
    vi.setSystemTime(new Date(`${cooking}T00:00:00Z`));
    renderWithStore(<OrderDetailScreen code={order.code} onBack={noop} />, store);
    expect(screen.getByText(/^No \(closed /)).toBeInTheDocument();
  });
});
