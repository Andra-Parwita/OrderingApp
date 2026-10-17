import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 083: the seller switches a pickup order to delivery (with an address and "Check on map") and
// tells the customer; the customer's order page shows the update and the new way. Captures go to
// captures/p083.
test('seller changes pickup to delivery and the customer sees the update', async ({
  page,
  context,
}, testInfo) => {
  await markHowItWorksSeen(context);
  const firstName = `Chg-${Date.now()}-${testInfo.project.name}`.slice(0, 40);

  // A customer places a pickup order.
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByRole('radio', { name: 'Pickup' }).click();
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  const token = /\/o\/([^/]+)\/placed$/.exec(page.url())?.[1] ?? '';

  // The seller opens it and changes it to delivery.
  await page.goto('/seller/orders');
  await page
    .getByRole('searchbox')
    .or(page.getByRole('button', { name: 'Search orders' }))
    .first()
    .click();
  await page.getByRole('searchbox').fill(firstName);
  await page.getByText(firstName).first().click();
  await page.getByRole('button', { name: 'Change pickup or delivery' }).click();
  const sheet = page.getByRole('dialog', { name: 'Change pickup or delivery' });
  await sheet.getByRole('radio', { name: 'Delivery' }).click();
  await sheet.getByLabel('Street').fill('12 King William St');
  await sheet.getByLabel('Suburb').fill('Adelaide');
  await expect(sheet.getByRole('link', { name: 'Check on map' })).toHaveAttribute(
    'href',
    /12%20King%20William%20St/,
  );
  // D-105: the message carries no street.
  await expect(sheet.getByText('Your order is now for delivery.')).toBeVisible();
  await expect(sheet.getByText('Your order is now for delivery to')).toHaveCount(0);
  await page.screenshot({ path: 'captures/p083/seller-sheet.png', fullPage: true });
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Saved. ${firstName} was told.`)).toBeVisible();
  await expect(page.getByText('12 King William St, Adelaide')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible();
  await page.screenshot({ path: 'captures/p083/seller-after.png', fullPage: true });

  // The customer's order page shows the update and the new way.
  await page.goto(`/o/${token}`);
  await expect(page.getByTestId('updates')).toContainText('Your order is now for delivery.');
  await expect(page.getByTestId('updates')).not.toContainText('King William');
  await page.screenshot({ path: 'captures/p083/customer-page.png', fullPage: true });
});
