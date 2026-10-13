import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { createFakeLive } from '../../api/liveTestSupport';
import { pollingStarted, pollingStopped } from './sellerOrdersSlice';
import { createTestStore } from './testSupport';

// Plan 074: a live event names what changed, and Orders and Cook reload only that.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 300; i += 1) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('timed out');
}

let paths: Array<string> = [];
const counted = new Set<string>();
beforeEach(async () => {
  await mockStore.reset();
  paths = [];
  server.events.on('request:start', ({ request, requestId }) => {
    if (counted.has(requestId)) return;
    counted.add(requestId);
    paths.push(new URL(request.url).pathname);
  });
});
afterEach(() => {
  server.events.removeAllListeners();
});
const count = (path: string) => paths.filter((p) => p === path).length;

describe('Orders reloads by event type', () => {
  it('order.* = orders; menu.changed = the menu; stock.changed = nothing', async () => {
    const live = createFakeLive();
    const store = createTestStore({ saga: true, pollMs: 100_000, channel: live.channel });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
    live.status('live');
    await sleep(150);
    paths = [];

    live.event('stock.changed');
    await sleep(150);
    expect(paths).toEqual([]);

    live.event('order.changed', 'ABCDEF');
    await waitFor(() => count('/api/seller/orders') === 1);
    await sleep(100);
    expect(paths).toEqual(['/api/seller/orders']);

    paths = [];
    live.event('menu.changed');
    await sleep(200);
    expect(paths.length).toBeGreaterThan(0);
    expect(count('/api/seller/orders')).toBe(0);
    store.dispatch(pollingStopped());
  });
});
