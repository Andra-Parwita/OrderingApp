import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIG_TIMEOUT_MS, READ_TIMEOUT_MS, request, WRITE_TIMEOUT_MS } from './http';
import { resetNetState } from './netState';
import { setRetryDelays } from './retryPolicy';

// Plan 114 item 1: every call has a time limit; running out of time is the usual `network` failure.

const timeoutError = () => new DOMException('The operation timed out.', 'TimeoutError');

beforeEach(() => {
  resetNetState();
  setRetryDelays([1, 1, 1]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setRetryDelays([1000, 3000, 9000]);
});

describe('request timeout', () => {
  it('gives a read 10 s, a write 20 s and a big transfer 60 s', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({}))),
    );
    await request('/api/s/x/menu', (input) => input);
    await request('/api/orders/t', (input) => input, { method: 'PATCH', body: {} });
    await request('/api/seller/backup', (input) => input, { timeoutMs: BIG_TIMEOUT_MS });
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([
      READ_TIMEOUT_MS,
      WRITE_TIMEOUT_MS,
      BIG_TIMEOUT_MS,
    ]);
    expect([READ_TIMEOUT_MS, WRITE_TIMEOUT_MS]).toEqual([10_000, 45_000]);
  });

  it('still sends when AbortSignal.timeout does not exist (old browsers)', async () => {
    const fetchMock = vi.fn((...args: Array<unknown>) =>
      Promise.resolve(Response.json({ args: args.length })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const original: unknown = Reflect.get(AbortSignal, 'timeout');
    Reflect.set(AbortSignal, 'timeout', undefined);
    try {
      const result = await request('/api/s/x/menu', (input) => input);
      expect(result.ok).toBe(true);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(init?.signal).toBeUndefined();
    } finally {
      Reflect.set(AbortSignal, 'timeout', original);
    }
  });

  it('sends the signal with the call', async () => {
    const fetchMock = vi.fn((...args: Array<unknown>) =>
      Promise.resolve(Response.json({ args: args.length })),
    );
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/s/x/menu', (input) => input);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('turns a timed-out write into the network failure, without repeating it', async () => {
    const fetchMock = vi.fn(() => Promise.reject(timeoutError()));
    vi.stubGlobal('fetch', fetchMock);
    const result = await request('/api/s/x/orders', (input) => input, {
      method: 'POST',
      body: {},
    });
    expect(result).toMatchObject({ ok: false, error: 'network', status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a timed-out read, and a later answer wins', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(Response.json({ ok: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await request('/api/s/x/menu', (input) => input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true });
  });
});
