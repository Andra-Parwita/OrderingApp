// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Hotfix 1.0.43.3: public/sw.js keeps kitchen pictures (/images/*) cache-first in cache img-v1.

type FetchEvent = {
  request: { method: string; url: string; mode: string };
  respondWith: (answer: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};

const source = readFileSync('public/sw.js', 'utf8');

function boot(fetchImpl: (url: string) => Promise<Response>) {
  let listener: (event: FetchEvent) => void = () => undefined;
  const caches = new Map<string, Map<string, Response>>();
  const open = (name: string) => {
    const store = caches.get(name) ?? new Map<string, Response>();
    caches.set(name, store);
    return Promise.resolve({
      match: (r: { url: string }) => Promise.resolve(store.get(r.url)?.clone()),
      put: (r: { url: string }, response: Response) => {
        store.delete(r.url);
        store.set(r.url, response);
        return Promise.resolve();
      },
      keys: () => Promise.resolve([...store.keys()].map((url) => ({ url }))),
      delete: (r: { url: string }) => Promise.resolve(store.delete(r.url)),
      add: () => Promise.resolve(),
    });
  };
  const fetchSpy = vi.fn((request: { url: string }) => fetchImpl(request.url));
  runInNewContext(source, {
    self: {
      location: { origin: 'https://x.test' },
      addEventListener: (name: string, fn: typeof listener) => {
        if (name === 'fetch') listener = fn;
      },
    },
    caches: { open, keys: () => Promise.resolve([...caches.keys()]) },
    fetch: fetchSpy,
    URL,
    setTimeout,
  });
  const get = async (path: string) => {
    let answer: Promise<Response> | undefined;
    const pending: Array<Promise<unknown>> = [];
    listener({
      request: { method: 'GET', url: `https://x.test${path}`, mode: 'no-cors' },
      respondWith: (value) => {
        answer = value;
      },
      waitUntil: (work) => pending.push(work),
    });
    const response = await answer;
    await Promise.all(pending);
    return response;
  };
  return { get, caches, fetchSpy };
}

describe('service worker kitchen pictures', () => {
  it('serves a second request for the same /images/ url from img-v1', async () => {
    const sw = boot(() => Promise.resolve(new Response('jpeg', { status: 200 })));
    await sw.get('/images/sellers/s1/phoneBanner-abc.jpg');
    const again = await sw.get('/images/sellers/s1/phoneBanner-abc.jpg');
    expect(await again?.text()).toBe('jpeg');
    expect(sw.fetchSpy).toHaveBeenCalledTimes(1);
    expect(sw.caches.has('img-v1')).toBe(true);
  });

  it('keeps at most 60 pictures, dropping the oldest', async () => {
    const sw = boot(() => Promise.resolve(new Response('x', { status: 200 })));
    for (let i = 0; i < 62; i++) await sw.get(`/images/sellers/s1/p-${i}.jpg`);
    const kept = sw.caches.get('img-v1')!;
    expect(kept.size).toBe(60);
    expect(kept.has('https://x.test/images/sellers/s1/p-0.jpg')).toBe(false);
    expect(kept.has('https://x.test/images/sellers/s1/p-61.jpg')).toBe(true);
  });

  it('does not cache failed answers, and leaves other paths alone', async () => {
    const sw = boot(() => Promise.resolve(new Response('no', { status: 404 })));
    await sw.get('/images/sellers/s1/missing.jpg');
    expect(sw.caches.get('img-v1')?.size ?? 0).toBe(0);
    await sw.get('/brand/og-shaggybobo.png');
    await sw.get('/api/s/x/menu-not');
    expect(sw.caches.get('img-v1')?.size ?? 0).toBe(0);
  });
});
