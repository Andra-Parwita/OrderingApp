import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerOrder } from '../../../shared/domain';
import { getCustomerLiveState, resetCustomerLiveState } from '../../api/customerLiveState';
import { MY_ORDERS_CHANGED, MY_ORDERS_KEY, type SavedOrder } from '../../api/device/myOrders';
import type { SocketLike } from '../../api/live';
import { resetNetState } from '../../api/netState';
import { CustomerLiveHost } from './CustomerLiveHost';
import {
  AWAY_CHECK_MS,
  REFRESH_WINDOW_MS,
  startCustomerLive,
  tokenOfOrderUrl,
  type CustomerLiveDeps,
} from './liveConnection';
import { selectList, selectOrderPage } from './selectors';
import { listLoaded, orderLoaded } from './slice';
import { createTestStore } from './testSupport';

class FakeSocket implements SocketLike {
  static all: Array<FakeSocket> = [];
  closed = false;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  constructor(
    readonly url: string,
    readonly protocols: Array<string> = [],
  ) {
    FakeSocket.all.push(this);
  }
  send() {
    // heartbeat: nothing to do
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event('open'));
  }
  push(frame: object) {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ at: new Date().toISOString(), ...frame }),
      }),
    );
  }
  drop() {
    this.onclose?.(new CloseEvent('close'));
  }
  get tokens() {
    return this.protocols
      .filter((part) => part.startsWith('tok.'))
      .map((part) => part.slice(4))
      .join(',');
  }
}
const open = () => FakeSocket.all.filter((socket) => !socket.closed);
const lastSocket = () => FakeSocket.all[FakeSocket.all.length - 1] as FakeSocket;

const NOW = new Date('2026-10-14T10:00:00Z');
const entry = (over: Partial<SavedOrder> & { token: string; code: string }): SavedOrder => ({
  placedAt: NOW.toISOString(),
  sellerSlug: 'onde-onde',
  lastStatus: 'ordered',
  ...over,
});
function setOrders(entries: Array<SavedOrder>) {
  localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(MY_ORDERS_CHANGED));
}

let hidden = false;
function hide(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

function deps(over: Partial<CustomerLiveDeps> = {}) {
  const spies = {
    refreshOrder: vi.fn<(token: string) => void>(),
    refreshAll: vi.fn<() => void>(),
    backupMinutes: vi.fn(() => Promise.resolve(5)),
  };
  return {
    ...spies,
    deps: {
      createSocket: (url: string, protocols?: Array<string>) => new FakeSocket(url, protocols),
      ...spies,
      ...over,
    } satisfies CustomerLiveDeps,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  FakeSocket.all = [];
  localStorage.clear();
  resetNetState();
  resetCustomerLiveState();
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('which orders get a connection', () => {
  it('one socket per kitchen, with only the active orders of that kitchen', () => {
    setOrders([
      entry({ token: 'tok-a', code: 'AAA111' }),
      entry({ token: 'tok-b', code: 'BBB222', lastStatus: 'ready_for_pickup' }),
      entry({ token: 'tok-done', code: 'CCC333', lastStatus: 'collected' }),
      entry({ token: 'tok-gone', code: 'DDD444', closed: true }),
      entry({ token: 'tok-old', code: 'EEE555', placedAt: '2026-09-01T10:00:00Z' }),
      entry({ token: 'tok-other', code: 'FFF666', sellerSlug: 'dapur-demo' }),
      { code: 'GGG777', token: 'tok-noslug', placedAt: NOW.toISOString() },
    ]);
    const { deps: d } = deps();
    const stop = startCustomerLive(d);
    expect(open()).toHaveLength(2);
    const byKitchen = Object.fromEntries(
      open().map((socket) => [new URL(socket.url).pathname, socket.tokens]),
    );
    expect(byKitchen).toEqual({
      '/api/s/onde-onde/live': 'tok-a,tok-b',
      '/api/s/dapur-demo/live': 'tok-other',
    });
    stop();
    expect(open()).toHaveLength(0);
  });

  it('opens nothing when no order is active, and says so', () => {
    setOrders([entry({ token: 't', code: 'AAA111', lastStatus: 'delivered' })]);
    const { deps: d } = deps();
    const stop = startCustomerLive(d);
    expect(FakeSocket.all).toHaveLength(0);
    expect(getCustomerLiveState().mode).toBe('none');
    stop();
  });

  it('a new order joins the connection at once, a finished one leaves, none left closes it', () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d } = deps();
    const stop = startCustomerLive(d);
    lastSocket().open();
    expect(getCustomerLiveState().mode).toBe('live');
    // order again
    setOrders([
      entry({ token: 'tok-a', code: 'AAA111' }),
      entry({ token: 'tok-n', code: 'NEW999' }),
    ]);
    expect(open()).toHaveLength(1);
    expect(open()[0]?.tokens).toBe('tok-a,tok-n');
    // the first order is collected
    setOrders([
      entry({ token: 'tok-a', code: 'AAA111', lastStatus: 'collected' }),
      entry({ token: 'tok-n', code: 'NEW999' }),
    ]);
    expect(open()).toHaveLength(1);
    expect(open()[0]?.tokens).toBe('tok-n');
    // the last one finishes
    setOrders([
      entry({ token: 'tok-a', code: 'AAA111', lastStatus: 'collected' }),
      entry({ token: 'tok-n', code: 'NEW999', lastStatus: 'cancelled' }),
    ]);
    expect(open()).toHaveLength(0);
    expect(getCustomerLiveState().mode).toBe('none');
    stop();
  });
});

describe('events', () => {
  it('an event for an order refreshes that order only; a bare nudge refreshes the list', () => {
    setOrders([
      entry({ token: 'tok-a', code: 'AAA111' }),
      entry({ token: 'tok-b', code: 'BBB222' }),
    ]);
    const { deps: d, refreshOrder, refreshAll } = deps();
    const stop = startCustomerLive(d);
    lastSocket().open();
    lastSocket().push({ type: 'order.changed', code: 'BBB222' });
    expect(refreshOrder.mock.calls).toEqual([['tok-b']]);
    expect(refreshAll).not.toHaveBeenCalled();
    lastSocket().push({ type: 'order.changed' });
    expect(refreshAll).toHaveBeenCalledTimes(1);
    stop();
  });

  it('events for one order within a second make one refresh now and one after', () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d, refreshOrder } = deps();
    const stop = startCustomerLive(d);
    lastSocket().open();
    for (let i = 0; i < 4; i += 1) lastSocket().push({ type: 'order.changed', code: 'AAA111' });
    expect(refreshOrder).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REFRESH_WINDOW_MS);
    expect(refreshOrder).toHaveBeenCalledTimes(2);
    stop();
  });

  it('a notification message from the service worker refreshes that order', () => {
    const worker = new EventTarget();
    Object.defineProperty(navigator, 'serviceWorker', { value: worker, configurable: true });
    setOrders([
      entry({ token: 'tok-a', code: 'AAA111' }),
      entry({ token: 'tok-b', code: 'BBB222' }),
    ]);
    const { deps: d, refreshOrder } = deps();
    const stop = startCustomerLive(d);
    worker.dispatchEvent(
      new MessageEvent('message', { data: { type: 'order-push', url: '/o/tok-a' } }),
    );
    expect(refreshOrder.mock.calls).toEqual([['tok-a']]);
    // a notification sent after 1.0.44 carries the address under the kitchen
    worker.dispatchEvent(
      new MessageEvent('message', { data: { type: 'order-push', url: '/dapur-demo/o/tok-b' } }),
    );
    expect(refreshOrder.mock.calls).toEqual([['tok-a'], ['tok-b']]);
    worker.dispatchEvent(new MessageEvent('message', { data: { type: 'other', url: '/o/x' } }));
    expect(refreshOrder).toHaveBeenCalledTimes(2);
    stop();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('reads the token from a notification address', () => {
    expect(tokenOfOrderUrl('/o/abc')).toBe('abc');
    expect(tokenOfOrderUrl('/o/abc/qr')).toBe('abc');
    // plan 102: the address under the kitchen
    expect(tokenOfOrderUrl('/onde-onde/o/abc')).toBe('abc');
    expect(tokenOfOrderUrl('/onde-onde/o/abc/qr?x=1')).toBe('abc');
    expect(tokenOfOrderUrl('/onde-onde/my-orders')).toBeNull();
    expect(tokenOfOrderUrl('/menu')).toBeNull();
    expect(tokenOfOrderUrl(5)).toBeNull();
  });
});

describe('backup check', () => {
  const MIN = 60_000;

  it('connected for 30 minutes: no checks at all', async () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d, refreshAll, refreshOrder, backupMinutes } = deps();
    const stop = startCustomerLive(d);
    lastSocket().open();
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(refreshAll).not.toHaveBeenCalled();
    expect(refreshOrder).not.toHaveBeenCalled();
    expect(backupMinutes).not.toHaveBeenCalled();
    stop();
  });

  it('while down and visible, checks every backupMinutes; silent once the socket is back', async () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d, refreshAll } = deps({ backupMinutes: () => Promise.resolve(3) });
    const stop = startCustomerLive(d);
    lastSocket().open();
    lastSocket().drop();
    await vi.advanceTimersByTimeAsync(0);
    expect(getCustomerLiveState()).toMatchObject({ mode: 'backup', minutes: 3 });
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(refreshAll).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(MIN);
    expect(refreshAll).toHaveBeenCalledTimes(1);
    // the connection returns: one instant check, then silence
    await vi.advanceTimersByTimeAsync(10_000);
    for (const socket of open()) socket.open();
    expect(getCustomerLiveState().mode).toBe('live');
    const afterReturn = refreshAll.mock.calls.length;
    expect(afterReturn).toBe(2);
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(refreshAll.mock.calls.length).toBe(afterReturn);
    stop();
  });

  it('does not check while the page is hidden, and checks at once on return', async () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d, refreshAll } = deps();
    const stop = startCustomerLive(d);
    lastSocket().drop();
    await vi.advanceTimersByTimeAsync(0);
    hide(true);
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(refreshAll).not.toHaveBeenCalled();
    hide(false);
    expect(refreshAll).toHaveBeenCalled();
    stop();
  });

  it('checks once on return after a while away even when connected, not after a quick glance', () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d, refreshAll } = deps();
    const stop = startCustomerLive(d);
    lastSocket().open();
    hide(true);
    vi.advanceTimersByTime(AWAY_CHECK_MS - 1000);
    hide(false);
    expect(refreshAll).not.toHaveBeenCalled();
    hide(true);
    vi.advanceTimersByTime(AWAY_CHECK_MS + 1000);
    hide(false);
    expect(refreshAll).toHaveBeenCalledTimes(1);
    stop();
  });

  it('never checks for finished orders', async () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111', lastStatus: 'delivered' })]);
    const { deps: d, refreshAll, backupMinutes } = deps();
    const stop = startCustomerLive(d);
    await vi.advanceTimersByTimeAsync(40 * MIN);
    hide(true);
    hide(false);
    expect(refreshAll).not.toHaveBeenCalled();
    expect(backupMinutes).not.toHaveBeenCalled();
    stop();
  });

  it('stops the backup check when the last order finishes', async () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const { deps: d, refreshAll } = deps();
    const stop = startCustomerLive(d);
    lastSocket().drop();
    await vi.advanceTimersByTimeAsync(0);
    setOrders([entry({ token: 'tok-a', code: 'AAA111', lastStatus: 'collected' })]);
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(refreshAll).not.toHaveBeenCalled();
    stop();
  });
});

describe('one connection for the whole app', () => {
  const order = (over: Partial<CustomerOrder> = {}): CustomerOrder => ({
    id: 'o1',
    code: 'AAA111',
    token: 'tok-a',
    firstName: 'Rina',
    language: 'en',
    lines: [],
    fulfilment: 'pickup',
    status: 'confirmed',
    locked: false,
    inbox: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    paid: false,
    seller: { slug: 'onde-onde', name: 'Onde' },
    ...over,
  });

  it('a pushed change updates the order page and My orders from one fetch', async () => {
    vi.useRealTimers();
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const fetched: Array<string> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        fetched.push(input);
        return Promise.resolve(Response.json({ order: order({ status: 'ready_for_pickup' }) }));
      }),
    );
    const store = createTestStore();
    store.dispatch(listLoaded({ orders: [order()], saved: [] }));
    store.dispatch(orderLoaded(order()));
    render(
      <Provider store={store}>
        <CustomerLiveHost
          deps={{
            createSocket: (url, protocols) => new FakeSocket(url, protocols),
            backupMinutes: () => Promise.resolve(5),
          }}
        />
      </Provider>,
    );
    // The order page and My orders share the one socket: there is exactly one.
    expect(open()).toHaveLength(1);
    act(() => {
      lastSocket().open();
      lastSocket().push({ type: 'order.changed', code: 'AAA111' });
    });
    await vi.waitFor(() => {
      const page = selectOrderPage(store.getState());
      expect(page.status === 'ready' && page.order.status).toBe('ready_for_pickup');
    });
    const list = selectList(store.getState());
    expect(list.status === 'ready' && list.orders[0]?.status).toBe('ready_for_pickup');
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('/api/orders/tok-a');
    vi.unstubAllGlobals();
  });

  it('order page open for 30 minutes on a live connection: no polling requests at all', async () => {
    setOrders([entry({ token: 'tok-a', code: 'AAA111' })]);
    const fetch = vi.fn(() => Promise.resolve(Response.json({ order: order() })));
    vi.stubGlobal('fetch', fetch);
    const store = createTestStore();
    store.dispatch(orderLoaded(order()));
    render(
      <Provider store={store}>
        <CustomerLiveHost
          deps={{ createSocket: (url, protocols) => new FakeSocket(url, protocols) }}
        />
      </Provider>,
    );
    act(() => {
      lastSocket().open();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60_000);
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
