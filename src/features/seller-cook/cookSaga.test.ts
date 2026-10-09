import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { createFakeLive } from '../../api/liveTestSupport';
import { staffSignedOut } from '../../api/staffSignedOut';
import { pollingStarted } from './cookSlice';
import { createTestStore } from './testSupport';

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
    const store = createTestStore({ saga: true, pollMs: 20, channel: live.channel });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerCook.list.status === 'ready');
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
