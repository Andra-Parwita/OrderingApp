import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  defaultPreview,
  defaultSellerHeadHtml,
  isSellerPath,
  sellerHeadHtml,
  kitchenHeadHtml,
  kitchenPageTarget,
  kitchenPreview,
  linkPreviewHtml,
  themeColourHtml,
} from './kitchenHeadLinks';

describe('kitchenPageTarget', () => {
  it('finds the kitchen or the order, and nothing for reserved or file paths', () => {
    expect(kitchenPageTarget('/onde-onde')).toEqual({ slug: 'onde-onde' });
    expect(kitchenPageTarget('/onde-onde/basket/name')).toEqual({ slug: 'onde-onde' });
    expect(kitchenPageTarget('/o/tok123/qr')).toEqual({ token: 'tok123' });
    for (const path of [
      '/',
      '/o',
      '/seller/orders',
      '/admin',
      '/my-orders',
      '/sw.js',
      '/assets/x',
    ]) {
      expect(kitchenPageTarget(path)).toBeNull();
    }
  });
});

describe('kitchenHeadHtml', () => {
  it('escapes the kitchen name and leaves it out when unknown', () => {
    const html = kitchenHeadHtml('k-1', `Bu "Rina" & <Co> 'x'`);
    expect(html).toContain('content="Bu &quot;Rina&quot; &amp; &lt;Co&gt; &#39;x&#39;"');
    expect(html).not.toContain('<Co>');
    expect(kitchenHeadHtml('k-1')).not.toContain('apple-mobile-web-app-title');
  });
});

describe('themeColourHtml', () => {
  it('is the theme background, different per theme', () => {
    expect(themeColourHtml('bali')).toMatch(/^<meta name="theme-color" content="#[0-9A-F]{6}">$/i);
    expect(themeColourHtml('bali')).not.toBe(themeColourHtml('onde'));
  });
});

describe('link preview (plan 047)', () => {
  it('uses the kitchen name and icon, with absolute escaped values', () => {
    const html = linkPreviewHtml(
      kitchenPreview('Bu "Rina" <Co>', { railIcon: '/images/sellers/x/icon.png' }),
      'https://order.example',
      '/bu-rina',
    );
    expect(html).toContain('property="og:title" content="Bu &quot;Rina&quot; &lt;Co&gt;"');
    expect(html).toContain('content="https://order.example/images/sellers/x/icon.png"');
    expect(html).toContain('property="og:image:width" content="512"');
    expect(html).toContain('property="og:url" content="https://order.example/bu-rina"');
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).not.toContain('<Co>');
  });

  it('falls back to the ShaggyBobo picture', () => {
    expect(linkPreviewHtml(kitchenPreview('Bu Rina'), 'https://o.x', '/bu')).toContain(
      'https://o.x/brand/og-shaggybobo.png',
    );
    const html = linkPreviewHtml(defaultPreview(), 'https://o.x', '/seller/setup');
    expect(html).toContain('content="ShaggyBobo&#39;s Order"');
    expect(html).toContain('/brand/og-shaggybobo.png');
  });
});

describe('the default seller app links (plan 048)', () => {
  it('link a manifest and an apple-touch-icon, and the file parses with the seller fields', () => {
    const html = defaultSellerHeadHtml();
    expect(html).toContain('<link rel="manifest" href="/seller.webmanifest">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/brand/app-icon-192.png">');
    const manifest = JSON.parse(readFileSync('public/seller.webmanifest', 'utf8')) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };
    expect(manifest).toMatchObject({
      name: 'ShaggyBobo Seller',
      short_name: 'Seller',
      start_url: '/seller',
      scope: '/seller',
      display: 'standalone',
    });
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(() => readFileSync(`public${icon.src}`)).not.toThrow();
    }
  });

  it('applies to /seller and below only, and a known kitchen keeps its own manifest', () => {
    expect(isSellerPath('/seller')).toBe(true);
    expect(isSellerPath('/seller/sign-in')).toBe(true);
    expect(isSellerPath('/sellers')).toBe(false);
    expect(sellerHeadHtml('onde-onde')).toContain('/k/onde-onde/seller.webmanifest');
  });
});
