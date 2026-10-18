import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { createFakeLive } from '../api/liveTestSupport';
import { selectCookList } from '../features/seller-cook/cookSelectors';
import { staffSignedOut } from '../api/staffSignedOut';
import {
  pollingStarted as cookStarted,
  pollingStopped as cookStopped,
} from '../features/seller-cook/cookSlice';
import {
  pollingStarted as ordersPollingStarted,
  pollingStopped as ordersPollingStopped,
} from '../features/seller-orders/sellerOrdersSlice';
import { line, makeOrder } from '../features/seller-cook/testSupport';
import { createCookOrdersStore } from './cookOrdersSupport';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('timed out');
}

describe('cookSaga', () => {
  beforeEach(() => mockStore.reset());

  it('issues no seller fetch and closes the socket once staff sign out', async () => {
    const counter = { count: 0 };
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/seller/orders') counter.count += 1;
    });
    const live = createFakeLive();
    const store = createCookOrdersStore({ pollMs: 20, channel: live.channel });
    store.dispatch(cookStarted());
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    live.status('live');
    await sleep(60); // the connect reload settles
    store.dispatch(staffSignedOut());
    await waitFor(() => live.open() === 0);
    const atSignOut = counter.count;
    live.event('order.changed', 'ABCDEF'); // a late event must not refetch
    await sleep(120); // several fallback periods
    expect(counter.count).toBe(atSignOut);
    server.events.removeAllListeners();
  });

  it('loads the private orders of today next to the menu orders (plan 081)', async () => {
    const privateOrder = makeOrder({
      id: 'p1',
      code: 'PPPPPP',
      private: { eventDate: '2026-10-17', eventTime: '12:00' },
      lines: [line('nasi', 6)],
    });
    server.use(
      http.get('*/api/seller/private', ({ request }) => {
        expect(new URL(request.url).searchParams.get('day')).toBe('today');
        return HttpResponse.json({
          orders: [privateOrder],
          due: { today: 1, tomorrow: 0 },
          today: '2026-10-17',
        });
      }),
    );
    const store = createCookOrdersStore({ pollMs: 50 });
    store.dispatch(cookStarted());
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    expect(store.getState().sellerCook.privateOrders.map((o) => o.code)).toEqual(['PPPPPP']);
    expect(store.getState().sellerOrders.orders).toHaveLength(0);
    store.dispatch(staffSignedOut());
  });

  it('fetches the orders once and runs one live loop when Orders and Cook are both open (C5)', async () => {
    const counter = { orders: 0 };
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/seller/orders') counter.orders += 1;
    });
    const live = createFakeLive();
    const store = createCookOrdersStore({ pollMs: 20, channel: live.channel });
    store.dispatch(ordersPollingStarted()); // the Orders screen
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    live.status('live');
    await sleep(60);
    store.dispatch(cookStarted()); // Cook opens on top: no second orders fetch, no second loop
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    expect(store.getState().sellerCook.menu).not.toBeNull();
    expect(live.open()).toBe(1);
    const before = counter.orders;
    live.event('order.changed', 'ABCDEF');
    await sleep(120);
    expect(counter.orders - before).toBe(1); // one orders fetch per event, not two
    // Closing Cook keeps the Orders loop; closing Orders as well closes the socket.
    store.dispatch(cookStopped());
    await sleep(40);
    expect(live.open()).toBe(1);
    store.dispatch(ordersPollingStopped());
    await waitFor(() => live.open() === 0);
    server.events.removeAllListeners();
  });

  it('opened directly, Cook starts the Orders loading itself (no private orders fetch)', async () => {
    const counter = { orders: 0 };
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/seller/orders') counter.orders += 1;
    });
    const live = createFakeLive();
    const store = createCookOrdersStore({ pollMs: 500, channel: live.channel });
    store.dispatch(cookStarted());
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    expect(store.getState().sellerOrders.list.status).toBe('ready');
    expect(counter.orders).toBe(1);
    store.dispatch(cookStopped());
    server.events.removeAllListeners();
  });

  it('loads orders and menu, polls while shown and stops when not', async () => {
    const order = async (firstName: string) => {
      const result = await mockStore.createOrder({
        firstName,
        language: 'en',
        lines: [{ itemId: 'lemper', qty: 1 }],
        fulfilment: 'pickup',
      });
      if (!result.ok) throw new Error(result.message);
    };
    await order('Rina');
    const store = createCookOrdersStore({ pollMs: 20 });
    store.dispatch(cookStarted());
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    expect(store.getState().sellerCook.menu?.chefs.map((chef) => chef.name)).toEqual(['Chef Wati']);
    expect(store.getState().sellerOrders.orders).toHaveLength(1);

    await order('Tom');
    await waitFor(() => store.getState().sellerOrders.orders.length === 2);
    store.dispatch(cookStopped());
    await sleep(60);
    await order('Dewi');
    await sleep(100);
    expect(store.getState().sellerOrders.orders).toHaveLength(2);
  });
});
