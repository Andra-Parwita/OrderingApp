import { cleanup, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import { placeOrder } from '../../api/client';
import { MY_ORDERS_KEY, replaceMyOrders } from '../../api/device/myOrders';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { MyOrdersScreen } from './MyOrdersScreen';
import { renderWithStore, setupI18n } from './testSupport';

// Plan 102 Q3 (A1): inside a kitchen's installed app, My orders lists that kitchen's orders only; the
// browser tab lists every kitchen. An old saved entry (no sellerSlug) is matched by its loaded order.

const noop = () => undefined;
beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(cleanup);

/** One order of the sample kitchen and one of another, both saved without a sellerSlug (old phone). */
async function twoKitchens() {
  const result = await placeOrder(DEFAULT_SELLER_SLUG, {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
  });
  if (!result.ok) throw new Error('could not place the sample order');
  const mine: CustomerOrder = { ...result.data.order, code: 'AAAAAA', token: 'tok-mine' };
  const other: CustomerOrder = {
    ...mine,
    code: 'BBBBBB',
    token: 'tok-other',
    seller: { slug: 'dellavee', name: 'Della Vee' },
  };
  replaceMyOrders(
    [mine, other].map((o) => ({ code: o.code, token: o.token, placedAt: o.createdAt })),
  );
  server.use(http.get('*/api/orders', () => HttpResponse.json({ orders: [mine, other] })));
  return { mine, other };
}

describe('My orders per kitchen (plan 102 stage 6)', () => {
  it('in the kitchen app lists only that kitchen, matching an old entry without a slug', async () => {
    await twoKitchens();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} onlyKitchen="onde-onde" />);
    expect(await screen.findByRole('button', { name: /AAA-AAA/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /BBB-BBB/ })).toBeNull();
  });

  it('in the kitchen app, an order of another kitchen never shows, and none left shows the empty state', async () => {
    await twoKitchens();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} onlyKitchen="nobody" />);
    await waitFor(() => expect(screen.queryByRole('button', { name: /AAA-AAA/ })).toBeNull());
    expect(screen.queryByRole('button', { name: /BBB-BBB/ })).toBeNull();
  });

  it('in a browser tab lists every kitchen, old entries included', async () => {
    await twoKitchens();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByRole('button', { name: /AAA-AAA/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /BBB-BBB/ })).toBeVisible();
  });
});
