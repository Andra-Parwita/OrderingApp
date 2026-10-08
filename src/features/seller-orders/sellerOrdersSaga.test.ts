import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import {
  paidChangeRequested,
  pollingStarted,
  pollingStopped,
  statusChangeRequested,
} from './sellerOrdersSlice';
import { createTestStore } from './testSupport';

function newOrder(firstName: string) {
  const result = mockStore.createOrder({
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
    newOrder('Rina');
    const store = createTestStore({ saga: true, pollMs: 1000 });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    await waitFor(() => store.getState().sellerOrders.cookingDate !== null);
    expect(store.getState().sellerOrders.orders.map((o) => o.firstName)).toEqual(['Rina']);
    expect(store.getState().sellerOrders.cookingDate).toBe('2026-10-10');
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
    newOrder('Rina');
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
    const created = newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(statusChangeRequested({ code: created.code, to: 'confirmed' }));
    await waitFor(() => store.getState().sellerOrders.change.status === 'idle');
    const [saved] = store.getState().sellerOrders.orders;
    expect(saved?.status).toBe('confirmed');
    expect(saved?.audit[0]).toMatchObject({ what: 'status', detail: 'confirmed' });
  });

  it('keeps the failed change for a retry when the status is not allowed', async () => {
    const created = newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(statusChangeRequested({ code: created.code, to: 'delivered' }));
    await waitFor(() => store.getState().sellerOrders.change.status === 'error');
    expect(store.getState().sellerOrders.change).toEqual({
      status: 'error',
      failed: { kind: 'status', code: created.code, to: 'delivered' },
    });
  });

  it('toggles paid', async () => {
    const created = newOrder('Rina');
    const store = createTestStore({ saga: true });
    store.dispatch(paidChangeRequested({ code: created.code, paid: true }));
    await waitFor(() => store.getState().sellerOrders.change.status === 'idle');
    expect(store.getState().sellerOrders.orders[0]?.paid).toBe(true);
  });
});
