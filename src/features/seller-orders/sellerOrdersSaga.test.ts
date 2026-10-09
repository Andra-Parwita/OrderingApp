import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { createFakeLive } from '../../api/liveTestSupport';
import { staffSignedOut } from '../../api/staffSignedOut';
import {
  refreshRequested,
  paidChangeRequested,
  pollingStarted,
  pollingStopped,
  statusChangeRequested,
  warningConfirmed,
} from './sellerOrdersSlice';
import { chooseSeller, SELLER_KEY } from '../../api/device/sellerContext';
import { createTestStore } from './testSupport';

async function newOrder(firstName: string) {
  const result = await mockStore.createOrder({
    firstName,
    language: 'en',
    lines: [{ itemId: 'nasi-campur', qty: 1 }],
    fulfilment: 'pickup',
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('timed out');
}

describe('sellerOrdersSaga', () => {
  beforeEach(() => mockStore.reset());

  it('loads the list and the cooking date when polling starts', async () => {
    await newOrder('Rina');
    const store = createTestStore({ saga: true, pollMs: 1000 });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    await waitFor(() => store.getState().sellerOrders.cookingDate !== null);
    expect(store.getState().sellerOrders.orders.map((o) => o.firstName)).toEqual(['Rina']);
    // The date now comes from the current menu (GET /api/seller/menus/current).
    expect(store.getState().sellerOrders.cookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    store.dispatch(pollingStopped());
  });

  it('polls repeatedly while the list is shown and stops when it is not', async () => {
    let requests = 0;
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/seller/orders') requests += 1;
    });
    const store = createTestStore({ saga: true, pollMs: 20 });
    store.dispatch(pollingStarted());
    await waitFor(() => requests >= 3);
    store.dispatch(pollingStopped());
    await sleep(40); // let an in-flight request finish
    const stoppedAt = requests;
    await sleep(150);
    expect(requests).toBe(stoppedAt);
    server.events.removeAllListeners();
  });

  it('marks the list as not live when a poll fails, and keeps the orders', async () => {
    await newOrder('Rina');
    const store = createTestStore({ saga: true, pollMs: 20 });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    server.use(http.get('*/api/seller/orders', () => new HttpResponse(null, { status: 500 })));
    await waitFor(() => {
      const { list } = store.getState().sellerOrders;
      return list.status === 'ready' && list.live === 'error';
    });
    expect(store.getState().sellerOrders.orders).toHaveLength(1);
    store.dispatch(pollingStopped());
  });

  it('shows an error state when the very first load fails', async () => {
    server.use(http.get('*/api/seller/orders', () => new HttpResponse(null, { status: 500 })));
    const store = createTestStore({ saga: true, pollMs: 1000 });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'error');
    store.dispatch(pollingStopped());
  });

  it('changes the status and stores the saved order with its audit entry', async () => {
    const created = await newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(statusChangeRequested({ code: created.code, to: 'confirmed' }));
    await waitFor(() => store.getState().sellerOrders.change.status === 'idle');
    const [saved] = store.getState().sellerOrders.orders;
    expect(saved?.status).toBe('confirmed');
    expect(saved?.audit[0]).toMatchObject({ what: 'status', detail: 'confirmed' });
  });

  it('asks first when the status skips a step, and goes ahead with force on "Continue anyway" (D-062)', async () => {
    const created = await newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(statusChangeRequested({ code: created.code, to: 'delivered' }));
    await waitFor(() => store.getState().sellerOrders.warned !== null);
    expect(store.getState().sellerOrders.warned?.warning.code).toBe('status_out_of_order');
    // Nothing was saved while it waits for the answer.
    expect(store.getState().sellerOrders.orders.some((order) => order.status === 'delivered')).toBe(
      false,
    );
    store.dispatch(warningConfirmed());
    await waitFor(() => store.getState().sellerOrders.orders[0]?.status === 'delivered');
    expect(store.getState().sellerOrders.warned).toBeNull();
  });

  it('confirming raises a toast whose Undo goes back to the old status', async () => {
    const created = await newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(statusChangeRequested({ code: created.code, to: 'confirmed', from: 'ordered' }));
    await waitFor(() => store.getState().sellerOrders.toast !== null);
    expect(store.getState().sellerOrders.toast).toMatchObject({
      kind: 'confirmed',
      undo: { kind: 'status', code: created.code, to: 'ordered' },
    });
  });

  it('toggles paid', async () => {
    const created = await newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(paidChangeRequested({ code: created.code, paid: true }));
    await waitFor(() => store.getState().sellerOrders.change.status === 'idle');
    expect(store.getState().sellerOrders.orders[0]?.paid).toBe(true);
  });

  it('sends the chosen seller as X-Seller on seller calls, and lists only their orders', async () => {
    await newOrder('Rina');
    const seen: Array<string | null> = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/seller/orders') {
        seen.push(request.headers.get('X-Seller'));
      }
    });
    chooseSeller('dapur-demo');
    const store = createTestStore({ saga: true, pollMs: 1000 });
    store.dispatch(refreshRequested());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    expect(seen).toContain('dapur-demo');
    expect(store.getState().sellerOrders.orders.map((o) => o.firstName)).not.toContain('Rina');
    localStorage.removeItem(SELLER_KEY);
    server.events.removeAllListeners();
  });
});

describe('sellerOrdersSaga live updates', () => {
  beforeEach(() => mockStore.reset());

  function ordersRequests() {
    const counter = { count: 0 };
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/seller/orders') counter.count += 1;
    });
    return counter;
  }

  it('reloads on an event, once for a burst, and does not poll while the socket is live', async () => {
    const counter = ordersRequests();
    const live = createFakeLive();
    const store = createTestStore({ saga: true, pollMs: 20, channel: live.channel });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    live.status('live');
    await sleep(80); // the (re)connect reload settles
    const settled = counter.count;
    await sleep(100); // several fallback periods: a live socket needs none
    expect(counter.count).toBe(settled);

    await newOrder('Wati');
    live.event('order.created', 'ABCDEF');
    live.event('order.changed', 'ABCDEF');
    live.event('order.changed', 'ABCDEF');
    await waitFor(() =>
      store.getState().sellerOrders.orders.some((order) => order.firstName === 'Wati'),
    );
    await sleep(60);
    expect(counter.count - settled).toBeLessThanOrEqual(2);
    store.dispatch(pollingStopped());
    server.events.removeAllListeners();
  });

  it('polls as a fallback while the socket is down, and reloads when it comes back', async () => {
    const counter = ordersRequests();
    const live = createFakeLive();
    const store = createTestStore({ saga: true, pollMs: 20, channel: live.channel });
    store.dispatch(pollingStarted());
    await waitFor(() => counter.count >= 3); // never live: it keeps polling
    live.status('live');
    await sleep(250); // a poll already sent still answers: the API is a real database now
    const settled = counter.count;
    await sleep(80);
    expect(counter.count).toBe(settled);
    live.status('reconnecting');
    await waitFor(() => counter.count >= settled + 2);
    store.dispatch(pollingStopped());
    server.events.removeAllListeners();
  });

  it('closes the live channel when the screen stops', async () => {
    const live = createFakeLive();
    const store = createTestStore({ saga: true, pollMs: 1000, channel: live.channel });
    store.dispatch(pollingStarted());
    await waitFor(() => live.open() === 1);
    store.dispatch(pollingStopped());
    await waitFor(() => live.open() === 0);
    expect(live.opened()).toBe(1);
  });

  it('issues no seller fetch and closes the socket once staff sign out', async () => {
    const counter = ordersRequests();
    const live = createFakeLive();
    const store = createTestStore({ saga: true, pollMs: 20, channel: live.channel });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
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
});
