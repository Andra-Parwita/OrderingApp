// @vitest-environment node
// Safety net for plans 101/102 (docs/plans/102-route-safety-checklist.md): pins today's Worker-side
// page heads, manifests and icons so the route change cannot break installed apps and old links.
// Runs against a local D1; see mocks/impl.ts. Tests only: no product code is touched.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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

  const manifestOf = async (slug: string, query = '', file = 'manifest.webmanifest') => {
    const res = await handleKitchenRequest(
      world.repo,
      new Request(`${origin}/k/${slug}/${file}${query}`),
    );
    expect(res?.status).toBe(200);
    return (await res?.json()) as KitchenManifest;
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
    expect((await manifestOf('onde-onde')).start_url).toBe('/onde-onde');
    expect((await manifestOf('onde-onde', '?start=/unknown/page')).start_url).toBe('/onde-onde');
    // today /my-orders and /settings are not valid manifest starts (they fall back to the menu)
    expect((await manifestOf('onde-onde', '?start=/my-orders')).start_url).toBe('/onde-onde');
  });

  it('the per-kitchen seller manifest today: id, start and scope /seller', async () => {
    for (const slug of slugs) {
      const m = await manifestOf(slug, '', 'seller.webmanifest');
      expect([m.id, m.start_url, m.scope]).toEqual(['/seller', '/seller', '/seller']);
    }
  });

  it('icons: each manifest icon answers 200 or a redirect to a public file that exists', async () => {
    for (const slug of slugs) {
      const m = await manifestOf(slug);
      expect(m.icons.length).toBeGreaterThan(0);
      for (const icon of m.icons) {
        const res = await handleKitchenRequest(world.repo, new Request(`${origin}${icon.src}`));
        expect(res, icon.src).not.toBeNull();
        if (res?.status === 302) {
          const target = res.headers.get('Location') ?? '';
          expect(existsSync(resolve('public', `.${target}`)), `${icon.src} -> ${target}`).toBe(
            true,
          );
        } else {
          expect(res?.status, icon.src).toBe(200);
        }
      }
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

    for (const path of [
      `/o/${token}`,
      `/o/${token}/placed`,
      `/o/${token}/qr`,
      `/o/${token}/edit`,
      `/o/${token}/edit/name`,
    ]) {
      const page = await kitchenPageFor(world.repo, path, origin);
      expect(page?.head, path).toContain('/k/onde-onde/manifest.webmanifest?start=');
      expect(page?.head, path).toContain(encodeURIComponent(`/o/${token}?source=homescreen`));
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

  it('today /<slug>/o/<token> is read as the plain kitchen page (no order start)', async () => {
    const page = await kitchenPageFor(world.repo, '/onde-onde/o/some-token', origin);
    expect(page?.head).toContain('/k/onde-onde/manifest.webmanifest?start=%2Fonde-onde');
  });

  it.todo('102: /<slug>/o/<token> head carries the order start_url (?source=homescreen)');
  it.todo('102: /<wrongslug>/o/<token> resolves the real kitchen from the token');
  it.todo('101: /seller with no ?k= never links a per-kitchen seller manifest');
});
