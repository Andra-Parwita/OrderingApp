import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { createFakeLive } from '../../api/liveTestSupport';
import { pollingStarted as cookStarted, pollingStopped as cookStopped } from './cookSlice';
import { createTestStore as createCookStore } from './testSupport';

// Plan 074: a live event names what changed, and Cook reloads only that.

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

describe('Cook reloads by event type', () => {
  it('order.changed = orders + made + private today; menu.changed = the menu; stock.changed = nothing', async () => {
    const live = createFakeLive();
    const store = createCookStore({ saga: true, pollMs: 100_000, channel: live.channel });
    store.dispatch(cookStarted());
    await waitFor(() => store.getState().sellerCook.list.status === 'ready');
    live.status('live');
    await sleep(150);
    paths = [];

    live.event('stock.changed');
    await sleep(150);
    expect(paths).toEqual([]);

    live.event('order.changed');
    await waitFor(() => paths.length >= 3);
    await sleep(100);
    expect([...paths].sort()).toEqual([
      '/api/seller/made',
      '/api/seller/orders',
      '/api/seller/private',
    ]);

    paths = [];
    live.event('menu.changed');
    await waitFor(() => paths.length >= 1);
    await sleep(100);
    expect(paths).toEqual(['/api/seller/menu']);
    store.dispatch(cookStopped());
  });
});
