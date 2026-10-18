import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../mocks/handlers';
import { createFakeLive } from '../api/liveTestSupport';
import {
  pollingStarted as cookStarted,
  pollingStopped as cookStopped,
} from '../features/seller-cook/cookSlice';
import { selectCookList } from '../features/seller-cook/cookSelectors';
import { createCookOrdersStore } from './cookOrdersSupport';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('timed out');
}

async function order(firstName: string) {
  const result = await mockStore.createOrder({
    firstName,
    language: 'en',
    lines: [{ itemId: 'lemper', qty: 1 }],
    fulfilment: 'pickup',
  });
  if (!result.ok) throw new Error(result.message);
}

describe('cookSaga live updates', () => {
  beforeEach(() => mockStore.reset());

  it('reloads on an event instead of polling while the socket is live', async () => {
    const live = createFakeLive();
    const store = createCookOrdersStore({ pollMs: 20, channel: live.channel });
    store.dispatch(cookStarted());
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    live.status('live');
    await sleep(80);

    await order('Tom'); // no poll runs, so the screen does not know yet
    await sleep(100);
    expect(store.getState().sellerOrders.orders).toHaveLength(0);

    live.event('order.created', 'ABCDEF');
    await waitFor(() => store.getState().sellerOrders.orders.length === 1);
    store.dispatch(cookStopped());
  });

  it('polls again when the socket is down, and closes the channel on stop', async () => {
    const live = createFakeLive();
    const store = createCookOrdersStore({ pollMs: 20, channel: live.channel });
    store.dispatch(cookStarted());
    await waitFor(() => selectCookList(store.getState()).status === 'ready');
    live.status('live');
    await sleep(60);
    live.status('reconnecting');
    await order('Dewi');
    await waitFor(() => store.getState().sellerOrders.orders.length === 1);
    store.dispatch(cookStopped());
    await waitFor(() => live.open() === 0);
  });
});
