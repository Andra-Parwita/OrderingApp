// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Plan 115 stage 2: public/sw.js answers a customer page from its saved copy at once (one copy per
// kitchen) and refreshes that copy from the network in the background.

type FetchEvent = {
  request: { method: string; url: string; mode: string };
  respondWith: (answer: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};

const source = readFileSync('public/sw.js', 'utf8');
const html = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const body = async (response: Response | undefined) => (await response?.text()) ?? '';

function boot(fetchImpl: () => Promise<Response>, saved: Record<string, string> = {}) {
  let listener: (event: FetchEvent) => void = () => undefined;
  const store = new Map<string, Response>(Object.entries(saved).map(([k, v]) => [k, html(v)]));
  const cache = {
    match: (key: string) => Promise.resolve(store.get(key)?.clone()),
    put: (key: string, response: Response) => {
      store.set(key, response);
      return Promise.resolve();
    },
    add: () => Promise.resolve(),
  };
  runInNewContext(source, {
    self: {
      location: { origin: 'https://x.test' },
      addEventListener: (name: string, fn: typeof listener) => {
        if (name === 'fetch') listener = fn;
      },
    },
    caches: { open: () => Promise.resolve(cache), keys: () => Promise.resolve([]) },
    fetch: fetchImpl,
    URL,
    setTimeout,
  });
  const open = (path: string) => {
    let answer: Promise<Response> | undefined;
    const pending: Array<Promise<unknown>> = [];
    listener({
      request: { method: 'GET', url: `https://x.test${path}`, mode: 'navigate' },
      respondWith: (value) => {
        answer = value;
      },
      waitUntil: (work) => pending.push(work),
    });
    return { answer, pending };
  };
  return { open, store };
}

describe('service worker pages', () => {
  it('answers from the saved copy without waiting for the network, then replaces the copy', async () => {
    let finish: (response: Response) => void = () => undefined;
    const network = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const sw = boot(() => network, { '/onde-onde': 'old page' });
    const { answer, pending } = sw.open('/onde-onde');
    expect(await body(await answer)).toBe('old page'); // network still pending
    finish(html('new page'));
    await Promise.all(pending);
    expect(await body(sw.store.get('/onde-onde'))).toBe('new page');
  });

  it("never serves one kitchen's copy for another; order links keep their own copy", async () => {
    const sw = boot(() => Promise.resolve(html('from network')), {
      '/onde-onde': 'onde page',
      '/o/abc': 'order page',
    });
    expect(await body(await sw.open('/onde-onde/orders').answer)).toBe('onde page');
    expect(await body(await sw.open('/o/abc').answer)).toBe('order page');
    expect(await body(await sw.open('/della-vee').answer)).toBe('from network');
    expect(await body(await sw.open('/o/xyz').answer)).toBe('from network');
  });

  it('keeps one copy per order link, under the kitchen or the old /o/ address', async () => {
    const sw = boot(() => Promise.reject(new TypeError('offline')), {
      '/onde-onde': 'menu page',
      '/onde-onde/o/abc': 'order page',
      '/o/old': 'old order page',
      '/': 'shell',
    });
    expect(await body(await sw.open('/onde-onde/o/abc').answer)).toBe('order page');
    expect(await body(await sw.open('/onde-onde/o/abc/qr').answer)).toBe('order page');
    expect(await body(await sw.open('/onde-onde/o/xyz').answer)).toBe('shell');
    expect(await body(await sw.open('/della-vee/o/abc').answer)).toBe('shell');
    expect(await body(await sw.open('/onde-onde').answer)).toBe('menu page');
    expect(await body(await sw.open('/o/old/edit').answer)).toBe('old order page');
    expect(await body(await sw.open('/').answer)).toBe('shell');
  });

  it('saves a page per kitchen, only when it is a 200 HTML answer', async () => {
    const sw = boot(() => Promise.resolve(html('della')));
    const first = sw.open('/della-vee');
    await first.answer;
    await Promise.all(first.pending);
    expect(await body(sw.store.get('/della-vee'))).toBe('della');
    expect(sw.store.has('/onde-onde')).toBe(false);

    const bad = boot(() => Promise.resolve(html('missing', 404)));
    const miss = bad.open('/nope');
    await miss.answer;
    await Promise.all(miss.pending);
    expect(bad.store.has('/nope')).toBe(false);
  });

  it('offline with no copy for the kitchen shows the "/" shell; seller pages are never touched', async () => {
    const sw = boot(() => Promise.reject(new TypeError('offline')), { '/': 'shell' });
    expect(await body(await sw.open('/new-kitchen').answer)).toBe('shell');
    for (const path of ['/seller', '/seller/orders', '/admin/x']) {
      expect(sw.open(path).answer).toBeUndefined();
    }
  });
});
