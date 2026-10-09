import { expect, test } from '@playwright/test';
import { collectErrors, isDesktopProject, orderRow } from './sellerHelpers';

// Stage 8.3: the seller's list updates by itself when a customer orders, through the seller's
// Durable Object, with no reload and no waiting for a poll (the fallback poll is 60 s).
// The mock store is shared by parallel tests: this spec never resets it and finds its own order
// by a unique first name.
test('a customer order appears on the open seller screen within 2 seconds, without a reload', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), 'the live list is checked on the desktop');
  const errors = collectErrors(page);

  // The dev app may open the socket more than once (React strict mode), so listen to every one.
  const frames: Array<string> = [];
  let sockets = 0;
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/api/seller/live')) return;
    sockets += 1;
    socket.on('framereceived', (data) => frames.push(data.payload.toString()));
  });
  await page.goto('/seller');
  await expect.poll(() => sockets).toBeGreaterThan(0);
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  // Let the Durable Object accept the socket; the connect also reloads the list once.
  await page.waitForTimeout(500);

  // A different customer, in a different browser context, orders.
  const firstName = `Live-${Date.now()}`;
  const customer = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const placedAt = Date.now();
    const created = await customer.request.post(
      new URL('/api/s/onde-onde/orders', page.url()).toString(),
      {
        data: {
          firstName,
          language: 'en',
          lines: [{ itemId: 'nasi-campur', qty: 1 }],
          fulfilment: 'pickup',
        },
      },
    );
    expect(created.ok()).toBe(true);

    await expect(orderRow(page, new RegExp(firstName))).toBeVisible({ timeout: 2000 });
    expect(Date.now() - placedAt).toBeLessThan(2500);

    // Whatever event arrived first (other specs order on the same kitchen too) is a nudge only:
    // a type, an order code and a time. No name, no token.
    await expect.poll(() => frames.some((frame) => frame.includes('"order.'))).toBe(true);
    const text = frames.find((frame) => frame.includes('"order.')) ?? '';
    expect(JSON.parse(text)).toEqual({
      type: expect.stringMatching(/^order.(created|changed)$/) as unknown,
      code: expect.stringMatching(/^[A-Z0-9]{6}$/) as unknown,
      at: expect.any(String) as unknown,
    });
    expect(text).not.toContain(firstName);
  } finally {
    await customer.close();
  }

  expect(errors).toEqual([]);
});
