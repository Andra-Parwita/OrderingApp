import { expect, test, type Page } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 105: the seller edits a customer's order (count, remove, add), a cancelled order is
// re-activated, and the customer's order page shows "Changed by the kitchen".

async function placeOrder(page: Page, firstName: string): Promise<string> {
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByRole('radio', { name: 'Pickup' }).click();
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  return /\/o\/([^/]+)\/placed$/.exec(page.url())?.[1] ?? '';
}

async function openOrder(page: Page, firstName: string) {
  await page.goto('/seller/orders');
  await page
    .getByRole('searchbox')
    .or(page.getByRole('button', { name: 'Search orders' }))
    .first()
    .click();
  await page.getByRole('searchbox').fill(firstName);
  await page.getByText(firstName).first().click();
}

test('seller changes a count, removes and adds a dish; the customer sees it', async ({
  page,
  context,
}, testInfo) => {
  await markHowItWorksSeen(context);
  const firstName = `Ed-${Date.now()}-${testInfo.project.name}`.slice(0, 40);
  const token = await placeOrder(page, firstName);
  await openOrder(page, firstName);
  await page.getByRole('button', { name: 'Edit order', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /^Edit order/ });
  await expect(sheet.getByText('Ordered by the customer')).toBeVisible();
  await sheet.getByRole('button', { name: 'One more Tilapia pesmol' }).click();
  await sheet.getByRole('button', { name: 'Remove Thin battered tempeh' }).click();
  await expect(sheet.getByRole('button', { name: 'Undo' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Add dish' }).click();
  await page.screenshot({ path: `scratch/b105-add-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'Done' }).click();
  await page.screenshot({ path: `scratch/b105-edit-${testInfo.project.name}.png` });
  await expect(sheet.getByRole('checkbox', { name: /Tell the customer/ })).toBeChecked();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/saved/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy message' })).toBeVisible();
  await expect(page.getByText('2×Tilapia pesmol').or(page.getByText('×2')).first()).toBeVisible();

  await page.goto(`/o/${token}`);
  await expect(page.getByTestId('edited-band')).toContainText('Changed by the kitchen');
  await expect(page.getByTestId('updates')).toContainText('Changed by the kitchen');
  await expect(page.getByTestId('updates')).toContainText('Tilapia pesmol');
});

test('a cancelled order is saved and re-activated', async ({ page, context }, testInfo) => {
  await markHowItWorksSeen(context);
  const firstName = `Re-${Date.now()}-${testInfo.project.name}`.slice(0, 40);
  await placeOrder(page, firstName);
  await openOrder(page, firstName);
  // Cancel it through the seller API (the UI path is covered elsewhere), then look again.
  const code = (
    await page
      .getByText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)
      .first()
      .innerText()
  ).trim();
  const done = await page.request.post(`/api/seller/orders/${code}/status`, {
    data: { to: 'cancelled' },
  });
  expect(done.ok()).toBe(true);
  await page.reload();
  await expect(page.getByText('Cancelled').first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit order', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /^Edit order/ });
  await sheet.getByRole('button', { name: 'One more Tilapia pesmol' }).click();
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Save and re-activate' }).click();
  await expect(page.getByText('Ordered').first()).toBeVisible();
});
