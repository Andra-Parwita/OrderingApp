// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Plan 114 item 5: public/sw.js shows its cached copy when the network is slow (not dead), and
// lets the network answer refresh the cache. sw.js is plain script, so it runs here against fakes.

type FetchEvent = {
  request: { method: string; url: string; mode: string };
  respondWith: (answer: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};
type Listener = (event: FetchEvent) => void;

const source = readFileSync('public/sw.js', 'utf8');

function boot(fetchImpl: () => Promise<Response>, cached: Response | undefined) {
  const listeners = new Map<string, Listener>();
  const stored = new Map<string, Response>();
  const cache = {
    match: () => Promise.resolve(cached),
    put: (_key: unknown, response: Response) => {
      stored.set('last', response);
      return Promise.resolve();
    },
    add: () => Promise.resolve(),
  };
  const self = {
    location: { origin: 'https://x.test' },
    addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
  };
  runInNewContext(source, {
    self,
    caches: { open: () => Promise.resolve(cache), keys: () => Promise.resolve([]) },
    fetch: fetchImpl,
    URL,
    setTimeout,
  });
  const run = (path: string, mode = 'cors') => {
    let answer: Promise<Response> | undefined;
    const pending: Array<Promise<unknown>> = [];
    listeners.get('fetch')?.({
      request: { method: 'GET', url: `https://x.test${path}`, mode },
      respondWith: (value) => {
        answer = value;
      },
      waitUntil: (work) => pending.push(work),
    });
    return { answer, pending };
  };
  return { run, stored };
}

const body = async (response: Response | undefined) => (await response?.text()) ?? '';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('service worker on a slow link', () => {
  it('shows the cached menu after 4.5 s while the network is still loading, then refreshes the cache', async () => {
    let finish: (response: Response) => void = () => undefined;
    const network = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const sw = boot(() => network, new Response('cached'));
    const { answer, pending } = sw.run('/api/s/onde-onde/menu');
    const seen = vi.fn();
    void answer?.then(seen);
    await vi.advanceTimersByTimeAsync(4400);
    expect(seen).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(await body(await answer)).toBe('cached');
    finish(new Response('fresh'));
    await Promise.all(pending);
    expect(await body(sw.stored.get('last'))).toBe('fresh');
  });

  it('uses the network answer when it comes in time', async () => {
    const sw = boot(() => Promise.resolve(new Response('fresh')), new Response('cached'));
    const { answer } = sw.run('/', 'navigate');
    await vi.advanceTimersByTimeAsync(10);
    expect(await body(await answer)).toBe('fresh');
  });

  it('a fast network answer is returned at once: no timer needed, never the cached copy', async () => {
    const sw = boot(() => Promise.resolve(new Response('fresh')), new Response('cached'));
    for (const [path, mode] of [
      ['/api/s/onde-onde/menu', 'cors'],
      ['/', 'navigate'],
    ] as const) {
      const { answer } = sw.run(path, mode);
      // No timers advanced at all: the answer is the network's.
      expect(await body(await answer)).toBe('fresh');
    }
  });

  it('falls back to the copy at once when the network fails, and to the error with no copy', async () => {
    const down = () => Promise.reject(new TypeError('offline'));
    const withCopy = boot(down, new Response('cached'));
    expect(await body(await withCopy.run('/api/orders/abc').answer)).toBe('cached');
    const without = boot(down, undefined);
    const bare = without.run('/api/orders/abc').answer;
    await expect(bare).rejects.toThrow('offline');
  });

  it('never touches seller calls, other pages or the version file', () => {
    const sw = boot(() => Promise.resolve(new Response('x')), new Response('cached'));
    for (const path of ['/api/seller/orders', '/seller/orders', '/version.json']) {
      expect(sw.run(path).answer).toBeUndefined();
    }
  });
});
