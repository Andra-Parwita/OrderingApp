import { expect, test } from '@playwright/test';

// Plan 011: the kitchen's manifest and icon links are in the HTML a phone first receives (not added by
// React later), and the icon address always answers with an image.
test('the served HTML of a kitchen page has the manifest and icon links', async ({ request }) => {
  const html = await (await request.get('/onde-onde')).text();
  expect(html).toContain('rel="manifest" href="/k/onde-onde/manifest.webmanifest');
  expect(html).toContain('rel="apple-touch-icon" href="/k/onde-onde/apple-touch-icon.png"');
  expect(html.match(/rel="manifest"/g)).toHaveLength(1);
  expect(html).toContain('apple-mobile-web-app-title" content="Onde Onde"');
  expect((await request.get('/seller')).ok()).toBe(true);
  // Plan 048: every /seller page links the one ShaggyBobo seller manifest, never a kitchen's.
  const sellerHtml = await (await request.get('/seller')).text();
  expect(sellerHtml).toContain('rel="manifest" href="/seller.webmanifest"');
  expect(sellerHtml).not.toContain('/k/');
  const icon = await request.get('/k/dapur-demo/apple-touch-icon.png');
  expect(icon.ok()).toBe(true);
  expect(icon.headers()['content-type']).toContain('image/');
});
