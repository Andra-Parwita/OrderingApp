import { expect, test } from '@playwright/test';
import { isDesktopProject, orderRow, searchBox } from './sellerHelpers';

// The mock store is shared by parallel tests: this spec never resets it and never asserts global
// counts; it finds its own orders by a unique first name.
test('seller handles a new customer, then adds a WhatsApp order', async ({
  page,
  request,
}, testInfo) => {
  const consoleErrors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const project = testInfo.project.name;
  const desktop = isDesktopProject(project);
  const stamp = Date.now();
  const customer = `Dewi-${project}-${stamp}`;
  const created = await request.post('/api/s/onde-onde/orders', {
    data: {
      firstName: customer,
      language: 'id',
      lines: [{ itemId: 'nasi-campur', qty: 1 }],
      fulfilment: 'pickup',
    },
  });
  expect(created.ok()).toBe(true);

  await page.goto('/seller');
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  await searchBox(page).fill(customer);
  const row = orderRow(page, new RegExp(customer));
  await expect(row).toContainText('New customer');
  await page.screenshot({ path: `captures/seller2-orders-${project}.png`, fullPage: true });

  await row.click();
  await expect(page.getByText(/Wait for their WhatsApp message/)).toBeVisible();
  await page.screenshot({ path: `captures/seller2-detail-${project}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Mark WhatsApp received' }).click();
  await expect(page.getByText(/^✓ WhatsApp received You can confirm.$/)).toBeVisible();

  await page.getByRole('button', { name: 'Nudge customer' }).click();
  await expect(page.getByText('Reminder sent to the customer')).toBeVisible();

  await page.getByRole('button', { name: 'Lock order' }).click();
  await expect(page.getByRole('button', { name: 'Unlock order' })).toBeVisible();
  if (!desktop) await expect(page.getByText(/Locked: the customer can no longer/)).toBeVisible();

  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Mark ready for pickup', exact: true }),
  ).toBeVisible();

  // "+ New order" for a WhatsApp customer.
  if (desktop) await page.getByRole('button', { name: 'Close' }).click();
  else await page.getByRole('button', { name: '‹ Orders' }).click();
  await page.getByRole('button', { name: '+ New order' }).click();
  await expect(page.getByRole('heading', { name: 'New order' })).toBeVisible();

  const walkIn = `Lisa-${project}-${stamp}`;
  await page.getByLabel('Customer first name').fill(walkIn);
  await page
    .getByRole('radiogroup', { name: 'Customer language' })
    .getByRole('radio', { name: 'EN', exact: true })
    .click();
  // Wait for the menu to load (the stepper exists and can go up), then for the value to update.
  for (const item of ['Tilapia pesmol', 'Thin battered tempeh']) {
    const stepper = page.getByRole('group', { name: item, exact: true });
    const more = stepper.getByRole('button', { name: `One more ${item}` });
    await expect(more).toBeEnabled();
    await more.click();
    await expect(stepper.locator('[aria-live="polite"]')).toHaveText('1');
  }
  await page.screenshot({ path: `captures/seller2-new-${project}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create order' }).click();

  await expect(page.getByText(/Starts as Confirmed/)).toBeVisible();
  await expect(page.getByText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send order link on WhatsApp' })).toBeVisible();
  await expect(page.getByLabel(/WhatsApp number \(optional, not saved\)/)).toBeVisible();
  await page.screenshot({ path: `captures/seller2-saved-${project}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Done' }).click();
  await searchBox(page).fill(walkIn);
  await expect(orderRow(page, new RegExp(walkIn))).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
