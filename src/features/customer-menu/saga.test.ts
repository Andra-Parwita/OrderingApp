import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import {
  menuRequested,
  orderRequested,
  placeRequested,
  quantitySet,
  type PlaceRequest,
} from './customerSlice';
import { MY_ORDERS_KEY, readMyOrders } from '../../api/device/myOrders';
import { createTestStore } from './testSupport';

const request: PlaceRequest = {
  firstName: '  Rina  ',
  language: 'id',
  fulfilment: 'delivery',
  note: ' no chilli ',
};

async function storeWithMenu() {
  const store = createTestStore();
  store.dispatch(menuRequested());
  await vi.waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  return store;
}

beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(() => vi.restoreAllMocks());

describe('customer saga', () => {
  it('loads the menu from the mock API', async () => {
    const store = await storeWithMenu();
    const menu = store.getState().customer.menu;
    expect(menu.status === 'ready' && menu.data.items.length).toBeGreaterThan(0);
  });

  it('maps a failed menu load to an error code', async () => {
    server.use(http.get('*/api/menu', () => new HttpResponse(null, { status: 500 })));
    const store = createTestStore();
    store.dispatch(menuRequested());
    await vi.waitFor(() =>
      expect(store.getState().customer.menu).toEqual({ status: 'error', code: 'bad_response' }),
    );
  });

  it('places an order, keeps it, empties the basket and saves it to My orders', async () => {
    const store = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
    store.dispatch(placeRequested(request));
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    const { place, order, basket } = store.getState().customer;
    expect(basket).toEqual({});
    expect(order.status === 'ready' && order.order).toMatchObject({
      firstName: 'Rina',
      language: 'id',
      fulfilment: 'delivery',
      note: 'no chilli',
      lines: [{ itemId: 'tempe-mendoan', qty: 2 }],
    });
    const saved = readMyOrders();
    expect(saved).toHaveLength(1);
    expect(place.status === 'placed' && saved[0]?.token).toBe(
      place.status === 'placed' && place.token,
    );
    expect(saved[0]?.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it.each([
    ['sold_out', 409],
    ['exceeds_remaining', 409],
    ['cutoff_passed', 409],
  ] as const)('maps %s to a failed result and keeps the basket', async (code, status) => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json({ error: code, message: 'nope' }, { status }),
      ),
    );
    const store = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    store.dispatch(placeRequested(request));
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('failed'));
    expect(store.getState().customer.place).toEqual({ status: 'failed', code, message: 'nope' });
    expect(store.getState().customer.basket).toEqual({ 'tempe-mendoan': 1 });
    expect(readMyOrders()).toEqual([]);
  });

  it('maps a network failure', async () => {
    server.use(http.post('*/api/orders', () => HttpResponse.error()));
    const store = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    store.dispatch(placeRequested(request));
    await vi.waitFor(() =>
      expect(store.getState().customer.place).toMatchObject({ status: 'failed', code: 'network' }),
    );
  });

  it('loads an order by token, and fails with not_found for an unknown one', async () => {
    const store = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    store.dispatch(placeRequested({ ...request, note: '' }));
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    const place = store.getState().customer.place;
    const token = place.status === 'placed' ? place.token : '';

    const other = createTestStore();
    other.dispatch(orderRequested(token));
    await vi.waitFor(() => expect(other.getState().customer.order.status).toBe('ready'));

    other.dispatch(orderRequested('unknown-token'));
    await vi.waitFor(() =>
      expect(other.getState().customer.order).toEqual({ status: 'error', code: 'not_found' }),
    );
  });
});
