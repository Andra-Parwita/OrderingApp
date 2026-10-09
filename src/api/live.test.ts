import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_PING } from '../../shared/liveContract';
import {
  BACKOFF_MAX_MS,
  backoffMs,
  connectLive,
  HEARTBEAT_MS,
  HEARTBEAT_TIMEOUT_MS,
  liveChannel,
  liveUrl,
  subscribeLive,
  type LiveStatus,
  type SocketLike,
} from './live';

class FakeSocket implements SocketLike {
  static all: Array<FakeSocket> = [];
  sent: Array<string> = [];
  closed = false;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event('open'));
  }
  receive(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
  drop() {
    this.onclose?.(new CloseEvent('close'));
  }
}

const create = (url: string) => new FakeSocket(url);
const last = () => FakeSocket.all[FakeSocket.all.length - 1] as FakeSocket;
const AT = '2026-10-10T08:00:00.000Z';

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function start() {
  const statuses: Array<LiveStatus> = [];
  const events: Array<string> = [];
  const connection = connectLive({
    url: () => 'wss://example.test/api/seller/live',
    createSocket: create,
    random: () => 0,
    onStatus: (status) => statuses.push(status),
    onEvent: (event) => events.push(`${event.type}:${event.code ?? ''}`),
  });
  return { statuses, events, connection };
}

describe('backoffMs', () => {
  it('doubles from 1 s up to 30 s, with jitter only taking time off', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => backoffMs(n, () => 0))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
    expect(backoffMs(0, () => 1)).toBe(750);
    expect(backoffMs(20, () => 0)).toBe(BACKOFF_MAX_MS);
  });
});

describe('connectLive', () => {
  it('goes connecting, then live when the socket opens, and delivers events', () => {
    const { statuses, events } = start();
    expect(statuses).toEqual(['connecting']);
    last().open();
    expect(statuses).toEqual(['connecting', 'live']);
    last().receive(JSON.stringify({ type: 'order.created', code: 'K7F2QX', at: AT }));
    last().receive('pong');
    last().receive('{"type":"nope","at":"x"}');
    expect(events).toEqual(['order.created:K7F2QX']);
  });

  it('reconnects with a growing wait, and starts over after a successful open', () => {
    const { statuses } = start();
    last().open();
    last().drop();
    expect(statuses.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);
    last().drop(); // never opened: the next wait is 2 s
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(3);
    last().open();
    expect(statuses.at(-1)).toBe('live');
    last().drop();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(4);
  });

  it('treats a socket that cannot be created like a lost connection', () => {
    const statuses: Array<LiveStatus> = [];
    connectLive({
      url: () => 'x',
      createSocket: () => {
        throw new Error('no WebSocket');
      },
      random: () => 0,
      onStatus: (status) => statuses.push(status),
      onEvent: () => undefined,
    });
    expect(statuses).toEqual(['connecting', 'reconnecting']);
  });

  it('pings while open and reconnects when nothing answers', () => {
    const { statuses } = start();
    const first = last();
    first.open();
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(first.sent).toEqual([LIVE_PING]);
    first.receive('pong');
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(first.sent).toEqual([LIVE_PING, LIVE_PING]);
    expect(first.closed).toBe(false);
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS);
    expect(first.closed).toBe(true);
    first.drop(); // a real socket reports the close
    expect(statuses.at(-1)).toBe('reconnecting');
  });

  it('close() stops everything: no reconnect, no pings', () => {
    const { connection } = start();
    const first = last();
    first.open();
    connection.close();
    expect(first.closed).toBe(true);
    first.drop();
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(first.sent).toEqual([]);
  });
});

describe('subscribeLive', () => {
  it('shares one socket between subscribers and closes it with the last one', () => {
    const a: Array<LiveStatus> = [];
    const b: Array<LiveStatus> = [];
    const stopA = subscribeLive({ onEvent: () => undefined, onStatus: (s) => a.push(s) }, create);
    last().open();
    const stopB = subscribeLive({ onEvent: () => undefined, onStatus: (s) => b.push(s) }, create);
    expect(FakeSocket.all).toHaveLength(1);
    expect(b).toEqual(['live']);
    stopA();
    expect(last().closed).toBe(false);
    stopB();
    expect(last().closed).toBe(true);
  });

  it('opens the seller socket on wss/ws with the chosen seller', () => {
    expect(liveUrl()).toMatch(/^ws:\/\/[^/]+\/api\/seller\/live\?seller=[a-z0-9-]+$/);
  });
});

describe('liveChannel', () => {
  it('turns statuses and events into messages and unsubscribes on close', () => {
    let listener: Parameters<typeof subscribeLive>[0] | undefined;
    const unsubscribe = vi.fn();
    const channel = liveChannel((l) => {
      listener = l;
      return unsubscribe;
    });
    const seen: Array<unknown> = [];
    channel.take((message) => seen.push(message));
    listener?.onStatus('live');
    expect(seen).toEqual([{ kind: 'status', status: 'live' }]);
    channel.close();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
