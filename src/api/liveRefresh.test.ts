import { runSaga, stdChannel } from 'redux-saga';
import { call } from 'redux-saga/effects';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectLive,
  getLiveLink,
  liveRefreshLoop,
  MAX_ATTEMPTS,
  subscribeLive,
  type LiveStatus,
  type SocketLike,
} from './live';
import { createFakeLive } from './liveTestSupport';
import {
  getNetSnapshot,
  MAX_REFUSALS,
  recordOutcome,
  requestRetry,
  resetNetState,
} from './netState';
import { staffSignedOut } from './staffSignedOut';

beforeEach(() => {
  vi.useFakeTimers();
  resetNetState();
});
afterEach(() => {
  vi.useRealTimers();
});

function start(statuses: Array<number>) {
  const live = createFakeLive();
  let loads = 0;
  const dispatched: Array<string> = [];
  function* load() {
    const status = statuses[Math.min(loads, statuses.length - 1)] ?? 200;
    loads += 1;
    yield call(() => {
      recordOutcome('GET', status);
    });
  }
  const task = runSaga(
    {
      channel: stdChannel(),
      dispatch: (action: { type: string }) => {
        dispatched.push(action.type);
      },
    },
    liveRefreshLoop,
    { load, fallbackMs: 1000, channel: live.channel },
  );
  return { task, loads: () => loads, dispatched };
}

describe('liveRefreshLoop', () => {
  it('stops after 5 refusals in a row and restarts on Try again', async () => {
    const { task, loads } = start([403]);
    await vi.advanceTimersByTimeAsync(10 * 60 * 60 * 1000);
    expect(loads()).toBe(MAX_REFUSALS);
    expect(getNetSnapshot().stopped).toBe(true);
    expect(task.isRunning()).toBe(true);
    requestRetry();
    await vi.advanceTimersByTimeAsync(0);
    expect(loads()).toBe(MAX_REFUSALS + 1);
    task.cancel();
  });

  it('backs off after a failure up to 5 minutes and resets on success', async () => {
    const { task, loads } = start([503, 503, 200, 200]);
    await vi.advanceTimersByTimeAsync(0);
    expect(loads()).toBe(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(loads()).toBe(1); // the gap is now 2 s
    await vi.advanceTimersByTimeAsync(1);
    expect(loads()).toBe(2);
    await vi.advanceTimersByTimeAsync(3999); // 4 s
    expect(loads()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(loads()).toBe(3); // success: back to 1 s
    await vi.advanceTimersByTimeAsync(1000);
    expect(loads()).toBe(4);
    task.cancel();
  });

  it('a success between refusals resets the count', async () => {
    const { task, loads } = start([403, 403, 403, 403, 200, 403, 403, 403, 403, 200]);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(getNetSnapshot().stopped).toBe(false);
    expect(loads()).toBeGreaterThan(10);
    task.cancel();
  });

  it('a 401 signs out and ends the loop', async () => {
    const { task, loads, dispatched } = start([401]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(loads()).toBe(1);
    expect(dispatched).toEqual([staffSignedOut.type]);
    expect(task.isRunning()).toBe(false);
  });
});

class Sock implements SocketLike {
  static all: Array<Sock> = [];
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  constructor() {
    Sock.all.push(this);
  }
  send() {
    // not used
  }
  close() {
    // not used
  }
}

describe('connectLive limits', () => {
  it('stops after the attempt cap, and an online event starts it again', async () => {
    Sock.all = [];
    const statuses: Array<LiveStatus> = [];
    const connection = connectLive({
      url: () => 'x',
      createSocket: () => new Sock(),
      random: () => 0,
      onStatus: (s) => statuses.push(s),
      onEvent: () => undefined,
    });
    for (let i = 0; i < MAX_ATTEMPTS + 3; i += 1) {
      Sock.all.at(-1)?.onclose?.(new CloseEvent('close'));
      await vi.advanceTimersByTimeAsync(40_000);
    }
    expect(Sock.all).toHaveLength(MAX_ATTEMPTS);
    window.dispatchEvent(new Event('online'));
    expect(Sock.all).toHaveLength(MAX_ATTEMPTS + 1);
    connection.close();
    window.dispatchEvent(new Event('online'));
    expect(Sock.all).toHaveLength(MAX_ATTEMPTS + 1);
  });

  it('closes the shared socket and does not reconnect after any call gets a 401', async () => {
    Sock.all = [];
    const stop = subscribeLive(
      { onEvent: () => undefined, onStatus: () => undefined },
      () => new Sock(),
    );
    expect(Sock.all).toHaveLength(1);
    recordOutcome('GET', 401);
    Sock.all[0]?.onclose?.(new CloseEvent('close'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(Sock.all).toHaveLength(1);
    expect(getLiveLink()).toBe('offline');
    stop();
  });
});
