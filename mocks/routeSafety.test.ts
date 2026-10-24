// @vitest-environment node
// Safety net for plans 101/102 (docs/plans/102-route-safety-checklist.md): pins today's Worker-side
// page heads, manifests and icons so the route change cannot break installed apps and old links.
// Runs against a local D1; see mocks/impl.ts. Tests only: no product code is touched.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { KitchenManifest } from '../shared/kitchenManifest';
import { handleKitchenRequest } from '../worker/api/kitchenRoutes';
import { kitchenPageFor } from '../worker/api/kitchenPage';
import { useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const TOKEN = 'token-1-padding-padding';
const origin = 'https://order.test';

const inside = (scope: string, url: string): boolean => {
  const path = new URL(url, origin).pathname;
  const base = scope === '/' ? '/' : scope.replace(/\/$/, '');
  return base === '/' || path === base || path.startsWith(`${base}/`);
};

describe('route safety: Worker pages, manifests and icons (plans 101/102)', () => {
  const create = useWorld('routeSafety');
  let world: World;
  let slugs: Array<string>;

  // The Worker's ASSETS binding, read from public/ (a 404 for anything else).
  const assets = {
    fetch: (req: Request): Promise<Response> => {
      const file = resolve('public', `.${new URL(req.url).pathname}`);
      return Promise.resolve(
        existsSync(file)
          ? new Response(readFileSync(file), { headers: { 'Content-Type': 'image/png' } })
          : new Response('no', { status: 404 }),
      );
    },
  };

  const manifestOf = async (
    slug: string,
    query = '',
    file = 'manifest.webmanifest',
    context: { kitchenScope?: boolean } = {},
  ) => {
    const res = await handleKitchenRequest(
      world.repo,
      new Request(`${origin}/k/${slug}/${file}${query}`),
      context,
    );
    expect(res?.status).toBe(200);
    return (await res?.json()) as KitchenManifest;
  };

  // One order of the first sample kitchen; its private token decides the kitchen of every order address.
  const placeOrder = async (): Promise<{ token: string }> => {
    const onde = await world.repo.sellerBySlug('onde-onde');
    if (!onde) throw new Error('no seller');
    const created = await onde.createOrder({
      firstName: 'Safety',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    if (!created.ok) throw new Error('order failed');
    return { token: created.value.token };
  };

  beforeEach(async () => {
    world = await create({ now: () => NOW, newToken: () => TOKEN });
    const rows = await world.db.all<{ slug: string }>('SELECT slug FROM sellers');
    slugs = rows.map((row) => row.slug);
  });

  it('knows at least the two sample kitchens', () => {
    expect(slugs).toEqual(expect.arrayContaining(['onde-onde', 'dapur-demo']));
  });

  it('every customer manifest: id is /<slug>, start_url inside scope for every start input', async () => {
    for (const slug of slugs) {
      const starts = [
        '',
        `?start=${encodeURIComponent(`/${slug}`)}`,
        `?start=${encodeURIComponent(`/o/${TOKEN}?source=homescreen`)}`,
        `?start=${encodeURIComponent(`/${slug}/o/${TOKEN}?source=homescreen`)}`,
        `?start=${encodeURIComponent('/my-orders')}`,
        `?start=${encodeURIComponent('/settings')}`,
        `?start=${encodeURIComponent('/somewhere/else')}`,
        `?start=${encodeURIComponent('//evil.example/x')}`,
        `?start=${encodeURIComponent('/../seller')}`,
      ];
      for (const query of starts) {
        const m = await manifestOf(slug, query);
        expect(m.id, `${slug} ${query}`).toBe(`/${slug}`);
        expect(inside(m.scope, m.start_url), `${slug} ${query} -> ${m.start_url}`).toBe(true);
        expect(m.display).toBe('standalone');
        // Hotfix 1.0.43.3: Android start screen is the dark launch colour, not the brand colour.
        expect(m.background_color, `${slug} ${query}`).toBe('#2A2B26');
      }
    }
  });

  it('start inputs today: an order start is kept; others fall back to /<slug>', async () => {
    const order = await manifestOf(
      'onde-onde',
      `?start=${encodeURIComponent(`/o/${TOKEN}?source=homescreen`)}`,
    );
    expect(order.start_url).toBe(`/o/${TOKEN}?source=homescreen`);
    expect(order.scope).toBe('/');
    // plan 102: the order start under its kitchen is kept as it is
    const under = await manifestOf(
      'onde-onde',
      `?start=${encodeURIComponent(`/onde-onde/o/${TOKEN}?source=homescreen`)}`,
    );
    expect(under.start_url).toBe(`/onde-onde/o/${TOKEN}?source=homescreen`);
    // another kitchen's order start is not this kitchen's start
    const other = await manifestOf(
      'onde-onde',
      `?start=${encodeURIComponent(`/dapur-demo/o/${TOKEN}?source=homescreen`)}`,
    );
    expect(other.start_url).toBe('/onde-onde');
    expect((await manifestOf('onde-onde')).start_url).toBe('/onde-onde');
    expect((await manifestOf('onde-onde', '?start=/unknown/page')).start_url).toBe('/onde-onde');
    // today /my-orders and /settings are not valid manifest starts (they fall back to the menu)
    expect((await manifestOf('onde-onde', '?start=/my-orders')).start_url).toBe('/onde-onde');
  });

  it('102 switch on: every kitchen, every start input: scope /<slug>/, id unchanged, start inside', async () => {
    for (const slug of slugs) {
      for (const query of [
        '',
        `?start=${encodeURIComponent(`/${slug}`)}`,
        `?start=${encodeURIComponent(`/o/${TOKEN}?source=homescreen`)}`,
        `?start=${encodeURIComponent(`/${slug}/o/${TOKEN}?source=homescreen`)}`,
        `?start=${encodeURIComponent('/my-orders')}`,
        `?start=${encodeURIComponent('//evil.example/x')}`,
      ]) {
        const m = await manifestOf(slug, query, 'manifest.webmanifest', { kitchenScope: true });
        expect(m.id, `${slug} ${query}`).toBe(`/${slug}`);
        expect(m.scope).toBe(`/${slug}/`);
        expect(inside(m.scope, m.start_url), `${slug} ${query} -> ${m.start_url}`).toBe(true);
      }
      // an order start is the order under its kitchen, inside the scope (plan 102 stage 4)
      const order = await manifestOf(
        slug,
        `?start=${encodeURIComponent(`/o/${TOKEN}?source=homescreen`)}`,
        'manifest.webmanifest',
        { kitchenScope: true },
      );
      expect(order.start_url).toBe(`/${slug}/o/${TOKEN}?source=homescreen`);
      // missing or off (the default) is today's scope
      expect((await manifestOf(slug, '', 'manifest.webmanifest', {})).scope).toBe('/');
    }
  });

  it('101: the per-kitchen seller manifest is /seller?k=<slug> in scope /seller (both switch values)', async () => {
    for (const slug of slugs) {
      for (const kitchenScope of [false, true]) {
        const m = await manifestOf(slug, '', 'seller.webmanifest', { kitchenScope });
        expect([m.id, m.start_url, m.scope]).toEqual([
          `/seller?k=${slug}`,
          `/seller?k=${slug}`,
          '/seller',
        ]);
        expect(m.background_color).toBe('#2A2B26');
        expect(inside(m.scope, m.start_url)).toBe(true);
      }
    }
  });

  // The sample kitchens carry a sample icon; take it away so the shared default is served.
  const withoutUpload = async (): Promise<Array<string>> => {
    await world.db.batch([world.db.stmt("DELETE FROM kitchen_images WHERE slot = 'railIcon'")]);
    return slugs;
  };

  it('102: the default icon answers 200 with the bytes of public/app-icon.png (no redirect)', async () => {
    const plain = await withoutUpload();
    expect(plain.length).toBeGreaterThan(0);
    const bytes = readFileSync(resolve('public/app-icon.png'));
    for (const slug of plain) {
      const m = await manifestOf(slug);
      for (const icon of [...m.icons.map((i) => i.src), `/k/${slug}/apple-touch-icon.png`]) {
        const res = await handleKitchenRequest(world.repo, new Request(`${origin}${icon}`), {
          assets,
        });
        expect(res?.status, icon).toBe(200);
        expect(res?.headers.get('Content-Type'), icon).toBe('image/png');
        expect(Buffer.from(await (res as Response).arrayBuffer()).equals(bytes), icon).toBe(true);
      }
    }
  });

  it('102: if the assets fail, the icon route falls back to the old redirect', async () => {
    const [slug] = await withoutUpload();
    const broken = { fetch: () => Promise.reject(new Error('down')) };
    const missing = { fetch: () => Promise.resolve(new Response('no', { status: 404 })) };
    for (const fake of [undefined, broken, missing]) {
      const res = await handleKitchenRequest(
        world.repo,
        new Request(`${origin}/k/${String(slug)}/icon-192.png`),
        { assets: fake },
      );
      expect(res?.status).toBe(302);
      expect(res?.headers.get('Location')).toBe('/app-icon.png');
    }
  });

  it('page heads: kitchen and order pages link the manifest; unknown token or slug gets none', async () => {
    const onde = await world.repo.sellerBySlug('onde-onde');
    if (!onde) throw new Error('no seller');
    const created = await onde.createOrder({
      firstName: 'Safety',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    if (!created.ok) throw new Error('order failed');
    const token = created.value.token;

    const menu = await kitchenPageFor(world.repo, '/onde-onde', origin);
    expect(menu?.head).toContain('href="/k/onde-onde/manifest.webmanifest?start=%2Fonde-onde"');

    // The old addresses still get the head (the Worker redirects them first); the start is the new shape.
    for (const path of [
      `/o/${token}`,
      `/o/${token}/placed`,
      `/o/${token}/qr`,
      `/o/${token}/edit`,
      `/o/${token}/edit/name`,
    ]) {
      const page = await kitchenPageFor(world.repo, path, origin);
      expect(page?.head, path).toContain('/k/onde-onde/manifest.webmanifest?start=');
      expect(page?.head, path).toContain(
        encodeURIComponent(`/onde-onde/o/${token}?source=homescreen`),
      );
      expect(page?.theme, path).toBeDefined();
    }

    // Unknown token / unknown slug: null (the Worker serves the plain SPA page, never a 404).
    expect(await kitchenPageFor(world.repo, '/o/no-such-token-at-all', origin)).toBeNull();
    expect(await kitchenPageFor(world.repo, '/no-such-kitchen', origin)).toBeNull();
    // Kitchen-less customer pages: no kitchen head (the app sets its links after load).
    expect(await kitchenPageFor(world.repo, '/my-orders', origin)).toBeNull();
    expect(await kitchenPageFor(world.repo, '/settings', origin)).toBeNull();
    // Seller: the shared default seller app links, never a kitchen manifest.
    const seller = await kitchenPageFor(world.repo, '/seller', origin);
    expect(seller?.head).toContain('rel="manifest" href="/seller.webmanifest"');
    expect(seller?.head).not.toContain('/k/');
  });

  it('101: /seller* with no k, an unknown or invalid k, or a lookup error keeps the default head', async () => {
    const lookupFails = {
      sellerBySlug: () => Promise.reject(new Error('db down')),
    } as unknown as typeof world.repo;
    for (const path of ['/seller', '/seller/orders', '/seller/sign-in']) {
      for (const search of [
        '',
        '?k=',
        '?k=no-such-kitchen',
        '?k=A%20B',
        '?k=../x',
        '?x=onde-onde',
      ]) {
        const page = await kitchenPageFor(world.repo, path, origin, search);
        expect(page?.head, `${path}${search}`).toContain(
          'rel="manifest" href="/seller.webmanifest"',
        );
        expect(page?.head, `${path}${search}`).not.toContain('/k/');
      }
      const failed = await kitchenPageFor(lookupFails, path, origin, '?k=onde-onde');
      expect(failed?.head).toContain('rel="manifest" href="/seller.webmanifest"');
    }
  });

  it("101: /seller* with a known k links that kitchen's seller app", async () => {
    for (const slug of slugs) {
      for (const path of ['/seller', '/seller/more']) {
        const page = await kitchenPageFor(world.repo, path, origin, `?k=${slug}`);
        expect(page?.head, `${path} ${slug}`).toContain(
          `<link rel="manifest" href="/k/${slug}/seller.webmanifest">`,
        );
        expect(page?.head).toContain(`href="/k/${slug}/apple-touch-icon.png"`);
        expect(page?.head).not.toContain('"/seller.webmanifest"');
      }
    }
    // customer pages ignore k
    const menu = await kitchenPageFor(world.repo, '/onde-onde', origin, '?k=dapur-demo');
    expect(menu?.head).toContain('/k/onde-onde/manifest.webmanifest');
  });

  it('102: /<slug>/o/<token> head carries the order start_url (?source=homescreen)', async () => {
    const { token } = await placeOrder();
    for (const sub of ['', '/placed', '/qr', '/edit', '/edit/name']) {
      const page = await kitchenPageFor(world.repo, `/onde-onde/o/${token}${sub}`, origin);
      expect(page?.head, sub).toContain('/k/onde-onde/manifest.webmanifest?start=');
      expect(page?.head, sub).toContain(
        encodeURIComponent(`/onde-onde/o/${token}?source=homescreen`),
      );
      expect(page?.theme, sub).toBeDefined();
    }
  });

  it('102: /<wrongslug>/o/<token> resolves the real kitchen from the token', async () => {
    const { token } = await placeOrder();
    const page = await kitchenPageFor(world.repo, `/dapur-demo/o/${token}`, origin);
    expect(page?.head).toContain('/k/onde-onde/manifest.webmanifest?start=');
    expect(page?.head).toContain(encodeURIComponent(`/onde-onde/o/${token}?source=homescreen`));
    expect(page?.head).not.toContain('/k/dapur-demo/');
  });

  it('122: kitchen and order pages ask for the translucent iPhone status bar; seller pages keep theirs', async () => {
    const { token } = await placeOrder();
    const meta = '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">';
    for (const path of [
      '/onde-onde',
      '/onde-onde/basket',
      `/onde-onde/o/${token}`,
      `/onde-onde/o/${token}/qr`,
      `/o/${token}`,
    ]) {
      expect((await kitchenPageFor(world.repo, path, origin))?.head, path).toContain(meta);
    }
    for (const path of ['/seller', '/seller/orders']) {
      const head = (await kitchenPageFor(world.repo, path, origin))?.head ?? '';
      expect(head, path).not.toContain('apple-mobile-web-app-status-bar-style');
    }
  });

  it('page titles: the kitchen name on its pages, "<Kitchen> · Order" on order pages (even under a wrong slug)', async () => {
    const { token } = await placeOrder();
    expect((await kitchenPageFor(world.repo, '/onde-onde', origin))?.title).toBe('Onde Onde');
    expect((await kitchenPageFor(world.repo, '/dapur-demo/basket', origin))?.title).toBe(
      'Dapur Demo',
    );
    for (const path of [`/onde-onde/o/${token}`, `/dapur-demo/o/${token}/qr`, `/o/${token}`]) {
      expect((await kitchenPageFor(world.repo, path, origin))?.title, path).toBe(
        'Onde Onde · Order',
      );
    }
    // Pages with no kitchen keep the file's own title.
    expect((await kitchenPageFor(world.repo, '/seller', origin))?.title).toBeUndefined();
  });

  it('102: an unknown token under a kitchen gets no order head (the app shows not found)', async () => {
    expect(
      await kitchenPageFor(world.repo, '/onde-onde/o/no-such-token-at-all', origin),
    ).toBeNull();
  });

  it('101: /seller with no ?k= never links a per-kitchen seller manifest', async () => {
    for (const path of ['/seller', '/seller/orders']) {
      const page = await kitchenPageFor(world.repo, path, origin);
      expect(page?.head, path).toContain('rel="manifest" href="/seller.webmanifest"');
      expect(page?.head, path).not.toContain('/k/');
    }
  });
});
