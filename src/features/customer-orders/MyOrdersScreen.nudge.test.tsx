import { cleanup, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the wiring matters here: which orders decide "an order is open" for the card.
vi.mock('./OrdersNudge', () => ({
  OrdersNudge: ({ hasOpenOrder }: { hasOpenOrder: boolean }) => (
    <p data-testid="nudge">{hasOpenOrder ? 'open' : 'none'}</p>
  ),
}));

import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import { placeOrder } from '../../api/client';
import { MY_ORDERS_KEY, replaceMyOrders } from '../../api/device/myOrders';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { MyOrdersScreen } from './MyOrdersScreen';
import { renderWithStore, setupI18n } from './testSupport';

// Plan 121A with D-120: the My orders card looks at this kitchen's orders only.

const noop = () => undefined;
beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(cleanup);

/** This kitchen's order and another kitchen's, with the given statuses. */
async function orders(mineStatus: CustomerOrder['status'], otherStatus: CustomerOrder['status']) {
  const result = await placeOrder(DEFAULT_SELLER_SLUG, {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
  });
  if (!result.ok) throw new Error('could not place the sample order');
  const mine: CustomerOrder = {
    ...result.data.order,
    code: 'AAAAAA',
    token: 'tok-mine',
    status: mineStatus,
  };
  const other: CustomerOrder = {
    ...mine,
    code: 'BBBBBB',
    token: 'tok-other',
    status: otherStatus,
    seller: { slug: 'dellavee', name: 'Della Vee' },
  };
  replaceMyOrders(
    [mine, other].map((o) => ({ code: o.code, token: o.token, placedAt: o.createdAt })),
  );
  server.use(http.get('*/api/orders', () => HttpResponse.json({ orders: [mine, other] })));
}

describe('My orders card per kitchen (D-120)', () => {
  it('sees an open order of this kitchen', async () => {
    await orders('confirmed', 'collected');
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} onlyKitchen="onde-onde" />);
    await waitFor(() => expect(screen.getByTestId('nudge')).toHaveTextContent('open'));
  });

  it('does not count an open order of another kitchen', async () => {
    await orders('collected', 'confirmed');
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} onlyKitchen="onde-onde" />);
    await screen.findByTestId('nudge');
    expect(screen.getByTestId('nudge')).toHaveTextContent('none');
  });
});
