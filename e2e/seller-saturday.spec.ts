import { expect, test, type APIRequestContext } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Saturday tools (stage 7.2c) through the dev harness (7.3 adds the routes). The mock store is
// shared by parallel tests: this spec never resets it, never asserts global counts, orders only
// unlimited items, and finds its own orders by a unique name. Runs on the Android and desktop
// projects; WebKit adds nothing here.

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

test('hand-over, delivery run and send update work together', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name.includes('webkit'), 'Android and desktop only');
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const suffix = String(Date.now()).slice(-5);
  const pickupName = `Sat${suffix}P`;
  const deliveryName = `Sat${suffix}D`;
  const pickup = await place(request, pickupName, 'pickup', ['confirmed', 'ready_for_pickup']);
  const delivery = await place(request, deliveryName, 'delivery', [
    'confirmed',
    'out_for_delivery',
  ]);

  // Send an update: "Ready in 15" to the pickup customer only.
  await page.goto('/?harness=seller-saturday&screen=update');
  await expect(page.getByRole('heading', { level: 1, name: 'Send an update' })).toBeVisible();
  await page.getByRole('button', { name: 'Pickup', exact: true }).click();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('checkbox', { name: `${pickupName} ${pickup.label}` }).check();
  await expect(page.getByRole('button', { name: 'Ready in…' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '15 min' }).click();
  await expect(
    page.getByText(
      'Every customer sees it in their order. Customers with updates on also get a notification.',
    ),
  ).toBeVisible();
  await page.screenshot({ path: `captures/saturday-update-${project}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Send to 1' }).click();
  await expect(page.getByText('Sent to 1 of 1 customers.')).toBeVisible();
  await page.screenshot({ path: `captures/saturday-update-sent-${project}.png`, fullPage: true });

  // The customer sees it in Updates.
  await page.goto(`/o/${pickup.token}`);
  await expect(page.getByTestId('updates')).toContainText(
    'Your food will be ready in about 15 minutes.',
  );

  // Hand-over: a sloppy code finds the order; one tap collects it.
  await page.goto('/?harness=seller-saturday&screen=handover');
  await expect(page.getByRole('heading', { level: 1, name: /^Pickup/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scan label' })).toBeDisabled();
  const sloppy = `${pickup.code.slice(0, 3).toLowerCase()} ${pickup.code.slice(3).toLowerCase()}`;
  await page.getByLabel('Type order code').fill(sloppy);
  const card = page.getByRole('article', { name: `Order ${pickup.label}` });
  await expect(card).toContainText(pickupName);
  await expect(card).toContainText('Ready for pickup');
  await page.screenshot({ path: `captures/saturday-handover-${project}.png`, fullPage: true });
  await card.getByRole('button', { name: 'Mark collected' }).click();
  await expect(page.getByText(`${pickupName}'s order ${pickup.label} is collected.`)).toBeVisible();
  await page.screenshot({
    path: `captures/saturday-handover-done-${project}.png`,
    fullPage: true,
  });

  // Delivery run: Arriving soon is one tap and reaches the customer.
  await page.goto('/?harness=seller-saturday&screen=delivery');
  await expect(page.getByRole('heading', { level: 1, name: /^Delivery/ })).toBeVisible();
  const run = page.getByRole('article', { name: `Order ${delivery.label}` });
  await expect(run).toContainText(deliveryName);
  await expect(run.getByRole('button', { name: 'Out for delivery' })).toBeDisabled();
  await run.getByRole('button', { name: 'Arriving soon' }).click();
  await expect(page.getByText(`Sent “arriving soon” to ${deliveryName}.`)).toBeVisible();
  await expect(
    page.getByText('Addresses are in your WhatsApp chats, not in the app (D-007).'),
  ).toBeVisible();
  await page.screenshot({ path: `captures/saturday-delivery-${project}.png`, fullPage: true });

  await page.goto(`/o/${delivery.token}`);
  await expect(page.getByTestId('updates')).toContainText('Your delivery is arriving soon.');

  expect(errors).toEqual([]);
});
