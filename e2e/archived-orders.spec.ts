import { expect, test } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// D-044: an order of a finished menu stays readable by its link, read-only. Finishing the menu changes
// the whole seller's menu, so this spec must run alone (its own Playwright project, after the
// others) and puts the mock back with a dev reset when it is done. Unlimited item only.

test('an order of a finished menu opens read-only from its link', async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  const errors = collectErrors(page);

  const created = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName: 'Arkhiv',
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 2 }],
      fulfilment: 'pickup',
    },
  });
  expect(created.ok()).toBe(true);
  const { order } = (await created.json()) as { order: { token: string } };

  try {
    const closed = await request.post('/api/seller/menus/current/finish', {
      headers: { 'X-Seller': 'onde-onde' },
    });
    expect(closed.ok()).toBe(true);

    await page.goto(`/o/${order.token}`);
    await expect(page.getByText('This menu is closed')).toBeVisible();
    await expect(page.getByText(/2× Lime-leaf mixed rice/)).toBeVisible();
    // Finishing the menu closes the order that was still open (D-069 Q4) as collected.
    await expect(page.getByText('Collected', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change order' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);

    // The server agrees: the link can be read but not changed.
    const read = await request.get(`/api/orders/${order.token}`);
    expect(read.ok()).toBe(true);
    const cancel = await request.post(`/api/orders/${order.token}/cancel`);
    expect(cancel.status()).toBe(409);
    expect(await cancel.json()).toMatchObject({ error: 'week_closed' });

    await page.screenshot({ path: 'captures/archived-order-desktop.png', fullPage: true });
  } finally {
    await request.post('/api/dev/reset');
  }

  expect(errors).toEqual([]);
});
