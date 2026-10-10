import { expect, test } from '@playwright/test';
import { isDesktopProject, orderRow, searchFor } from './sellerHelpers';

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
  await searchFor(page, customer);
  const row = orderRow(page, new RegExp(customer));
  await expect(row).toBeVisible();
  await page.screenshot({ path: `captures/seller2-orders-${project}.png`, fullPage: true });

  await row.click();
  await expect(page.getByText('★ New customer')).toBeVisible();
  await expect(page.getByText(/Wait for their WhatsApp message/)).toBeVisible();
  await page.screenshot({ path: `captures/seller2-detail-${project}.png`, fullPage: true });

  // The customer's order number arrived on WhatsApp: the prompt goes away, the row says so.
  await page.getByRole('button', { name: 'Mark WhatsApp received' }).click();
  await expect(page.getByRole('button', { name: 'Mark WhatsApp received' })).toHaveCount(0);
  await expect(page.getByText(/Wait for their WhatsApp message/)).toHaveCount(0);
  // The list sits beside the order on a tablet or desktop; a phone shows the order alone.
  if (desktop) {
    await expect(row.getByRole('img', { name: 'WhatsApp order number received' })).toBeVisible();
  }

  // On a desktop, Nudge and Lock live in the panel's ⋯ More menu (the Orders header has one too);
  // the phone screen keeps them as buttons.
  const more = page.getByRole('complementary', { name: /^Order / }).getByRole('button', {
    name: 'More',
    exact: true,
  });
  const action = async (name: RegExp) => {
    if (desktop) {
      await more.click();
      await page.getByRole('menuitem', { name }).click();
    } else await page.getByRole('button', { name }).click();
  };
  await action(/^Nudge/);
  await expect(page.getByText('Reminder sent to the customer')).toBeVisible();

  await action(/^Lock/);
  if (desktop) {
    await more.click();
    await expect(page.getByRole('menuitem', { name: /^Unlock/ })).toBeVisible();
    await page.keyboard.press('Escape');
  } else await expect(page.getByRole('button', { name: /^Unlock/ })).toBeVisible();
  if (desktop) await expect(row.getByRole('img', { name: 'Locked' })).toBeVisible();

  await page
    .getByRole('button', { name: desktop ? 'Confirm order' : 'Confirm only', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Mark ready for pickup', exact: true }),
  ).toBeVisible();

  // "New order" for a WhatsApp customer: a slide-over on a tablet or desktop, a screen on a phone.
  if (desktop) {
    await page
      .getByRole('complementary', { name: /^Order / })
      .getByRole('button', { name: 'Close' })
      .click();
  } else await page.getByRole('button', { name: '‹ Orders' }).click();
  await page.getByRole('button', { name: 'New order' }).click();
  await expect(page).toHaveURL(/\/seller\/new$/);
  const form = desktop ? page.getByRole('dialog', { name: 'New order' }) : page.getByRole('main');

  const walkIn = `Lisa-${project}-${stamp}`;
  await form.getByLabel('Customer first name').fill(walkIn);
  await form
    .getByRole('radiogroup', { name: 'Customer language' })
    .getByRole('radio', { name: /^(EN|English)$/ })
    .click();
  // Wait for the menu to load (the stepper exists and can go up), then for the value to update.
  for (const item of ['Tilapia pesmol', 'Thin battered tempeh']) {
    const stepper = form.getByRole('group', { name: item, exact: true });
    const more = stepper.getByRole('button', { name: `One more ${item}` });
    await expect(more).toBeEnabled();
    await more.click();
    await expect(stepper.getByRole('status')).toHaveText('1');
  }
  await page.screenshot({ path: `captures/seller2-new-${project}.png`, fullPage: true });
  await form.getByRole('button', { name: 'Create only' }).click();

  await expect(page).toHaveURL(/\/seller(\?.*)?$/);
  await searchFor(page, walkIn);
  const made = orderRow(page, new RegExp(walkIn));
  await expect(made).toBeVisible();
  await expect(made).toContainText('Confirmed');
  await page.screenshot({ path: `captures/seller2-saved-${project}.png`, fullPage: true });

  expect(consoleErrors).toEqual([]);
});
