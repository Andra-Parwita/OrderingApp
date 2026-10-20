// Safety net for plans 101/102 (docs/plans/102-route-safety-checklist.md): pins today's manifests,
// the static seller manifest and every place that builds an order link. Tests only.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kitchenPageTarget, manifestHref, sellerHeadHtml } from './kitchenHeadLinks';
import {
  DEFAULT_SELLER_MANIFEST_PATH,
  buildManifest,
  safeStartUrl,
  sellerManifestPath,
} from './kitchenManifest';
import { THEMES } from './themes';

const read = (file: string): string => readFileSync(resolve(file), 'utf8');

const isInScope = (scope: string, startUrl: string): boolean => {
  const path = new URL(startUrl, 'https://x.test').pathname;
  const base = scope === '/' ? '/' : scope.replace(/\/$/, '');
  return base === '/' || path === base || path.startsWith(`${base}/`);
};

const STARTS = [
  null,
  '/onde-onde',
  '/o/tok123?source=homescreen',
  '/o/tok123',
  '/my-orders',
  '/settings',
  '/other-kitchen',
  '/unknown/path',
  '//evil.test',
  '/onde-onde/../seller',
  '/seller',
  'o/tok',
];

describe('route safety: customer manifests (risk 2)', () => {
  it.each(THEMES)('theme %s: id /<slug>, start_url inside scope for every start', (theme) => {
    for (const start of STARTS) {
      const m = buildManifest({ slug: 'onde-onde', name: 'Onde Onde', theme, start });
      expect(m.id).toBe('/onde-onde');
      expect(isInScope(m.scope, m.start_url), `${String(start)} -> ${m.start_url}`).toBe(true);
      expect(m.display).toBe('standalone');
    }
  });

  it('today: scope is "/", an order start is kept, anything unknown falls back to /<slug>', () => {
    const base = { slug: 'onde-onde', name: 'Onde Onde', theme: 'onde' } as const;
    expect(buildManifest({ ...base, start: null }).scope).toBe('/');
    expect(safeStartUrl('/o/tok123?source=homescreen', 'onde-onde')).toBe(
      '/o/tok123?source=homescreen',
    );
    expect(safeStartUrl('/onde-onde', 'onde-onde')).toBe('/onde-onde');
    for (const bad of ['/unknown/path', '//evil.test', '/seller', '/my-orders', 'o/x', null]) {
      expect(safeStartUrl(bad, 'onde-onde')).toBe('/onde-onde');
    }
  });

  it('icons are same-origin /k/<slug>/icon-N.png paths, one maskable', () => {
    const m = buildManifest({ slug: 'onde-onde', name: 'Onde Onde', theme: 'onde', start: null });
    expect(m.icons.map((i) => i.src)).toEqual([
      '/k/onde-onde/icon-192.png',
      '/k/onde-onde/icon-512.png',
      '/k/onde-onde/icon-512.png',
    ]);
    expect(m.icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
  });

  it('the per-kitchen seller manifest keeps id, start and scope /seller', () => {
    const m = buildManifest({
      slug: 'onde-onde',
      name: 'Onde Onde',
      theme: 'onde',
      start: '/o/tok',
      seller: true,
    });
    expect([m.id, m.start_url, m.scope]).toEqual(['/seller', '/seller', '/seller']);
  });
});

describe('route safety: the old seller app (risk 4)', () => {
  it('public/seller.webmanifest is unchanged: any edit must be deliberate', () => {
    const manifest = JSON.parse(read('public/seller.webmanifest')) as {
      icons: Array<{ src: string }>;
    };
    expect(manifest).toEqual({
      id: '/seller',
      name: 'ShaggyBobo Seller',
      short_name: 'Seller',
      start_url: '/seller',
      scope: '/seller',
      display: 'standalone',
      background_color: '#F6F2E8',
      theme_color: '#F6F2E8',
      icons: [
        { src: '/brand/app-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/brand/app-icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    });
    for (const icon of manifest.icons) {
      expect(() => statSync(resolve('public', `.${icon.src}`))).not.toThrow();
    }
  });

  it('the default seller manifest path and the per-kitchen one keep their shape', () => {
    expect(DEFAULT_SELLER_MANIFEST_PATH).toBe('/seller.webmanifest');
    expect(sellerManifestPath('onde-onde')).toBe('/k/onde-onde/seller.webmanifest');
    expect(sellerHeadHtml('onde-onde')).toContain('href="/k/onde-onde/seller.webmanifest"');
  });
});

describe('route safety: page targets and manifest links', () => {
  it("kitchenPageTarget reads today's paths", () => {
    expect(kitchenPageTarget('/o/tok')).toEqual({ token: 'tok' });
    expect(kitchenPageTarget('/o/tok/qr')).toEqual({ token: 'tok' });
    expect(kitchenPageTarget('/onde-onde')).toEqual({ slug: 'onde-onde' });
    expect(kitchenPageTarget('/onde-onde/basket')).toEqual({ slug: 'onde-onde' });
    expect(kitchenPageTarget('/o')).toBeNull();
    expect(kitchenPageTarget('/')).toBeNull();
    // reserved words are not kitchens
    expect(kitchenPageTarget('/my-orders')).toBeNull();
    expect(kitchenPageTarget('/settings')).toBeNull();
    expect(kitchenPageTarget('/seller')).toBeNull();
  });

  it('manifestHref carries the start as an encoded query', () => {
    expect(manifestHref('onde-onde')).toBe('/k/onde-onde/manifest.webmanifest?start=%2Fonde-onde');
    expect(manifestHref('onde-onde', '/o/t?source=homescreen')).toBe(
      '/k/onde-onde/manifest.webmanifest?start=%2Fo%2Ft%3Fsource%3Dhomescreen',
    );
  });

  it.todo('102: kitchenPageTarget reads /<slug>/o/<token> as an order');
  it.todo('102: manifestHref start for an order is /<slug>/o/<token>?source=homescreen');
});

describe('route safety: where order links are built (risk 3)', () => {
  function sourceFiles(dir: string): Array<string> {
    const out: Array<string> = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
      else if (/\.(ts|tsx|js)$/.test(name) && !/\.test\./.test(name)) out.push(path);
    }
    return out;
  }

  it('the files that mention a "/o/" path are exactly today\'s list (a new one must be reviewed)', () => {
    const files = [...sourceFiles('src'), ...sourceFiles('worker'), ...sourceFiles('shared')];
    const hits = files
      .filter((f) => /\/o\//.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(/\\/g, '/'))
      .sort();
    expect(hits).toMatchInlineSnapshot(`
      [
        "shared/kitchenHeadLinks.ts",
        "shared/kitchenManifest.ts",
        "shared/logContract.ts",
        "shared/orderCode.ts",
        "src/api/device/whatsapp.ts",
        "src/app/CustomerShell.tsx",
        "src/app/ShellBanner.tsx",
        "src/app/customerRoutes.tsx",
        "src/components/install/InstallPictures.tsx",
        "src/components/install/manifestLinks.ts",
        "src/components/install/useInstallFlow.ts",
        "src/features/customer-orders/liveConnection.ts",
        "src/features/seller-orders/editMessage.ts",
        "src/features/seller-orders/useOrderActions.ts",
        "src/features/seller-orders/whatsappLink.ts",
        "worker/api/kitchenPage.ts",
        "worker/api/kitchenRoutes.ts",
        "worker/push/dispatch.ts",
      ]
    `);
  });

  it("push and menu-notice payload urls keep today's shape", () => {
    expect(read('worker/push/dispatch.ts')).toContain('data: { url: `/o/${change.order.token}` }');
    expect(read('worker/push/menuNotice.ts')).toContain('data: { url: `/${menu.slug}` }');
  });

  it('the service worker opens data.url as given and falls back to "/"', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("typeof data.url === 'string' ? data.url : '/'");
    expect(sw).toContain("type: 'order-push'");
  });
});
