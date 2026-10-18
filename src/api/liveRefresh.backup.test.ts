import { runSaga, stdChannel } from 'redux-saga';
import { call } from 'redux-saga/effects';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveRefreshLoop, type Changed } from './live';
import { createFakeLive } from './liveTestSupport';
import { sellerDeviceId } from './deviceId';
import { recordOutcome, resetNetState } from './netState';

// Plan 074: Orders and Cook run through liveRefreshLoop. The backup check uses the admin's
// minutes (read each time), runs only while the socket is down and the page is visible, and an
// event tells the loader which parts to reload.

const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  resetNetState();
  setHidden(false);
});
afterEach(() => {
  vi.useRealTimers();
});

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    value: hidden ? 'hidden' : 'visible',
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function start(fallbackMs: number | (() => number)) {
  const live = createFakeLive();
  const calls: Array<Changed> = [];
  function* load(changed: Changed) {
    calls.push(changed);
    yield call(() => {
      recordOutcome('GET', 200);
    });
  }
  const task = runSaga({ channel: stdChannel(), dispatch: () => undefined }, liveRefreshLoop, {
    load,
    fallbackMs,
    channel: live.channel,
  });
  return { task, live, calls };
}

describe('liveRefreshLoop (plan 103)', () => {
  it('the own-device event does not reload; another device does', async () => {
    const { task, live, calls } = start(() => 5 * MIN);
    await vi.advanceTimersByTimeAsync(0);
    live.status('live');
    await vi.advanceTimersByTimeAsync(0);
    const before = calls.length;
    live.event('order.changed', 'ABC123', sellerDeviceId());
    await vi.advanceTimersByTimeAsync(100);
    expect(calls.length).toBe(before);
    live.event('order.changed', 'ABC123', 'another-device');
    await vi.advanceTimersByTimeAsync(100);
    expect(calls.length).toBe(before + 1);
    live.event('order.changed', 'ABC123');
    await vi.advanceTimersByTimeAsync(100);
    expect(calls.length).toBe(before + 2);
    task.cancel();
  });
});

describe('liveRefreshLoop (plan 074)', () => {
  it('connected: no backup request however long it stays open', async () => {
    const { task, live, calls } = start(() => 5 * MIN);
    await vi.advanceTimersByTimeAsync(0);
    live.status('live');
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(calls.length).toBeLessThanOrEqual(1 + 1); // the first load (and at most one on the first connect)
    const before = calls.length;
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(calls.length).toBe(before);
    task.cancel();
  });

  it('down and visible: one check per backup interval, read from the setting each time', async () => {
    let minutes = 5;
    const { task, calls } = start(() => minutes * MIN);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(calls.length).toBe(2);
    minutes = 1; // read when the next wait starts
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(calls.length).toBe(3);
    await vi.advanceTimersByTimeAsync(MIN);
    expect(calls.length).toBe(4);
    task.cancel();
  });

  it('hidden: nothing asked; shown again: asks at once', async () => {
    const { task, calls } = start(() => 5 * MIN);
    await vi.advanceTimersByTimeAsync(0);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(calls.length).toBe(1);
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.length).toBe(2);
    expect(calls[1]).toBeNull();
    task.cancel();
  });

  it('an event passes its types to the loader; everything else loads everything', async () => {
    const { task, live, calls } = start(() => 5 * MIN);
    await vi.advanceTimersByTimeAsync(0);
    live.status('live');
    await vi.advanceTimersByTimeAsync(2500);
    calls.length = 0;
    live.event('stock.changed');
    await vi.advanceTimersByTimeAsync(0);
    live.event('menu.changed');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([new Set(['stock.changed']), new Set(['menu.changed'])]);
    task.cancel();
  });
});
