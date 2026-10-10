import { expect, test } from '@playwright/test';

// The ONLY spec that orders a limited item (Empek-empek, 10 portions). It runs in the serial
// "limits" project after every other project, so nothing else orders that item meanwhile. It
// still reads the current `remaining` first and asserts relative to it.
type MenuItem = { id: string; remaining: number | null; soldOut: boolean };

test('a limited item shows "1 left", then Sold out, and refuses more orders', async ({
  page,
  request,
}, testInfo) => {
  const menu = async (): Promise<MenuItem> => {
    const response = await request.get('/api/s/onde-onde/menu');
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { items: Array<MenuItem> };
    const item = body.items.find((entry) => entry.id === 'empek-empek');
    if (!item) throw new Error('empek-empek is missing from the menu');
    return item;
  };
  const order = (qty: number, name: string) =>
    request.post('/api/s/onde-onde/orders', {
      data: {
        firstName: `${name}-${testInfo.project.name}-${Date.now()}`,
        language: 'en',
        lines: [{ itemId: 'empek-empek', qty }],
        fulfilment: 'pickup',
      },
    });

  const start = await menu();
  expect(start.remaining).not.toBeNull();
  const remaining = start.remaining ?? 0;
  expect(remaining).toBeGreaterThanOrEqual(2);

  // Leave exactly one portion.
  expect((await order(remaining - 1, 'Limit')).ok()).toBe(true);
  expect((await menu()).remaining).toBe(1);

  await page.goto('/onde-onde/dishes');
  const row = page.getByRole('listitem').filter({ hasText: 'Palembang fish cake with egg' });
  await expect(row.getByText('1 left')).toBeVisible();

  // Take the last portion: sold out, and a further order is refused.
  expect((await order(1, 'Last')).ok()).toBe(true);
  expect((await menu()).soldOut).toBe(true);
  const refused = await order(1, 'Late');
  expect(refused.status()).toBe(409);

  await page.reload();
  await expect(row.getByText('Sold out')).toBeVisible();
});
