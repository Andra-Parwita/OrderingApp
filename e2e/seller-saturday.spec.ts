import { expect, test, type APIRequestContext } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Pickup & delivery (plan 001 stage 9) on the real route /seller/hand-over. The mock store is shared by
// parallel tests: this spec never resets it, never asserts global counts, orders only unlimited
// items, and finds its own orders by a unique name. Runs on the Android and desktop projects.
// A message to a place reaches every open order there, so each project sends its own number of
// minutes (the same message twice in a few minutes would ask "Send this again?").

type Made = { code: string; token: string; label: string };

async function place(
  request: APIRequestContext,
  firstName: string,
  fulfilment: 'pickup' | 'delivery',
  path: ReadonlyArray<string>,
): Promise<Made> {
  const created = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName,
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 2 }],
      fulfilment,
    },
  });
  expect(created.ok()).toBe(true);
  const { order } = (await created.json()) as { order: { code: string; token: string } };
  for (const to of path) {
    const moved = await request.post(`/api/seller/orders/${order.code}/status`, {
      headers: { 'X-Seller': 'onde-onde' },
      data: { to },
    });
    expect(moved.ok()).toBe(true);
  }
  return {
    code: order.code,
    token: order.token,
    label: `${order.code.slice(0, 3)}-${order.code.slice(3)}`,
  };
}

test('message a pickup place, and walk a delivery through its steps', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name.includes('webkit'), 'Android and desktop only');
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const minutes = project.includes('desktop') ? 20 : 15;
  const suffix = String(Date.now()).slice(-5);
  const pickupName = `Sat${suffix}P`;
  const deliveryName = `Sat${suffix}D`;
  const pickup = await place(request, pickupName, 'pickup', ['confirmed', 'ready_for_pickup']);
  const delivery = await place(request, deliveryName, 'delivery', [
    'confirmed',
    'out_for_delivery',
  ]);

  // Pickup: the order is in the place's column; "Ready in N min" tells the customers there.
  await page.goto('/seller/hand-over');
  await expect(page.getByRole('heading', { level: 1, name: /^Pickup & delivery/ })).toBeVisible();
  await page.getByLabel('Bag code or name').fill(pickupName);
  const column = page.getByLabel('Glen Waverley', { exact: true });
  const row = column.getByLabel(`Order ${pickup.label}, ${pickupName}`);
  await expect(row).toContainText('Ready');
  await page.screenshot({ path: `captures/saturday-handover-${project}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Message Glen Waverley' }).click();
  const dialog = page.getByRole('dialog', { name: 'Message Glen Waverley' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Ready in N min' }).check();
  await dialog.getByRole('radio', { name: `${minutes} min` }).check();
  await expect(dialog.getByText('This does not change any order')).toBeVisible();
  await page.screenshot({ path: `captures/saturday-update-${project}.png`, fullPage: true });
  await dialog.getByRole('button', { name: /^Send to \d+ orders?$/ }).click();
  await expect(page.getByText(/^Sent to \d+ orders? at Glen Waverley\.$/)).toBeVisible();

  // The customer sees it in Updates.
  await page.goto(`/o/${pickup.token}`);
  await expect(page.getByTestId('updates')).toContainText(`Ready in ${minutes} min`);

  // Delivery: Arriving soon (no time) is one tap and reaches the customer.
  await page.goto('/seller/hand-over');
  await page.getByRole('radio', { name: /^Delivery/ }).check();
  await page.getByLabel('Bag code or name').fill(deliveryName);
  const run = page.getByLabel(`Order ${delivery.label}, ${deliveryName}`);
  await expect(run).toContainText('Out for delivery');
  await run
    .getByLabel(`Minutes until ${delivery.label} arrives`)
    .selectOption({ label: 'no time' });
  await run.getByRole('button', { name: 'Arriving soon' }).click();
  await expect(page.getByText(`Told ${deliveryName} the order is arriving soon.`)).toBeVisible();
  await page.screenshot({ path: `captures/saturday-delivery-${project}.png`, fullPage: true });

  await page.goto(`/o/${delivery.token}`);
  await expect(page.getByTestId('updates')).toContainText('Arriving soon');

  expect(errors).toEqual([]);
});
