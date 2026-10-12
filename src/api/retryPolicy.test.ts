import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { request } from './http';
import { markOutcomes, outcomeSince, resetNetState } from './netState';
import { RETRY_DELAYS_MS, refused, retryDelayMs, setRetryDelays } from './retryPolicy';

const parse = (input: unknown) => (input === null || input === undefined ? null : input);
const good = () => new Response(JSON.stringify({ a: 1 }), { status: 200 });
const bad = (status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: 'x', message: 'm' }), { status, headers });

let fetchMock: Mock<typeof fetch>;
beforeEach(() => {
  vi.useFakeTimers();
  setRetryDelays(RETRY_DELAYS_MS);
  resetNetState();
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setRetryDelays([]);
});

describe('retryDelayMs', () => {
  it('is about 1 s, 3 s, 9 s with up to 25 % added', () => {
    expect([0, 1, 2].map((n) => retryDelayMs(n, null, () => 0))).toEqual([1000, 3000, 9000]);
    expect(retryDelayMs(0, null, () => 1)).toBe(1250);
  });
  it('honours Retry-After, capped at 30 s', () => {
    expect(retryDelayMs(0, '5')).toBe(5000);
    expect(retryDelayMs(0, '120')).toBe(30_000);
    expect(retryDelayMs(1, 'soon', () => 0)).toBe(3000);
  });
  it('calls 401, 403 and other 4xx refused, not 5xx', () => {
    expect([400, 401, 403, 404].every(refused)).toBe(true);
    expect(refused(503) || refused(200)).toBe(false);
  });
});

describe('request retries', () => {
  it('retries a 503 three times with growing waits, then fails', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(bad(503)));
    const pending = request('/api/x', parse);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(9000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries a network error and returns the first good answer', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(good());
    const pending = request('/api/x', parse);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({ ok: true, data: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry 400, 401, 403 or 404', async () => {
    for (const status of [400, 401, 403, 404]) {
      fetchMock.mockReset();
      fetchMock.mockImplementation(() => Promise.resolve(bad(status)));
      const result = await request('/api/x', parse);
      expect(result.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('waits the Retry-After of a 429', async () => {
    fetchMock.mockResolvedValueOnce(bad(429, { 'Retry-After': '7' })).mockResolvedValueOnce(good());
    const pending = request('/api/x', parse);
    await vi.advanceTimersByTimeAsync(6999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).ok).toBe(true);
  });

  it('never repeats a save: a POST fails once, after a response or without one', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(bad(503)));
    expect((await request('/api/x', parse, { method: 'POST', body: {} })).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const result = await request('/api/x', parse, { method: 'PATCH', body: {} });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('records how GET calls ended', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(bad(403)));
    const marker = markOutcomes();
    await request('/api/x', parse);
    expect(outcomeSince(marker)).toBe('refused');
  });
});
