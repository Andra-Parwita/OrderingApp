import { describe, expect, it } from 'vitest';
import { kitchenHeadHtml, kitchenPageTarget } from './kitchenHeadLinks';

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
