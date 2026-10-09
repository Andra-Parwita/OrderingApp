import { screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from '../../api/client';
import { MY_ORDERS_KEY, readMyOrders } from '../../api/device/myOrders';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { OrderScreen } from './OrderScreen';
import { renderWithStore, setupI18n } from './testSupport';

// Plan 004 stage 7, spec 6.4: an iPhone's installed app has storage of its own, so the order saved
// in Safari is not there. The manifest's start_url is /o/{token}?source=homescreen; opening it
// fetches the order and saves it to the app's own My orders.

beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));

describe('first open from the home screen', () => {
  it('fetches the order by the token in the start link and saves it to My orders', async () => {
    const placed = await placeOrder(DEFAULT_SELLER_SLUG, {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
    });
    if (!placed.ok) throw new Error('could not place the sample order');
    const { token, code } = placed.data.order;
    // The installed app starts empty: nothing was saved on this storage.
    expect(readMyOrders()).toEqual([]);
    window.history.replaceState(null, '', `/o/${token}?source=homescreen`);

    renderWithStore(
      <OrderScreen token={token} onBack={() => undefined} onChange={() => undefined} />,
    );

    await waitFor(() => expect(readMyOrders().map((entry) => entry.token)).toEqual([token]));
    expect(readMyOrders()[0]?.code).toBe(code);
    expect(await screen.findByTestId('timeline')).toBeVisible();
    window.history.replaceState(null, '', '/');
  });
});
