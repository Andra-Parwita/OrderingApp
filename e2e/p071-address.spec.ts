import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 071 stages 1-3: a delivery order with an address reaches the kitchen's team with a Directions
// link; the checkout shows the privacy line, then a saved card next time. Captures go to captures/p071.
test.use({ viewport: { width: 390, height: 844 } });

test('customer delivery address reaches the seller with Directions; saved card next time', async ({
  page,
  context,
}, testInfo) => {
  await markHowItWorksSeen(context);
  const firstName = `Addr-${Date.now()}-${testInfo.project.name}`.slice(0, 40);
  const addDishes = async () => {
    await page.goto('/onde-onde/dishes');
    await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
    await page.getByRole('button', { name: /View basket/ }).click();
    await page.getByRole('radio', { name: 'Delivery' }).click();
  };

  await addDishes();
  const street = page.getByLabel('Street number and name');
  await expect(street).toBeFocused();
  await expect(page.getByRole('button', { name: /Next: your name/ })).toBeDisabled();
  await street.fill('12 Jetty Road');
  await page.getByLabel('Suburb').fill('Glenelg');
  await page.getByLabel('Postcode').fill('5045');
  await page.getByLabel('Notes for the driver (optional)').fill('blue gate');
  await expect(page.getByText('Your address is kept safe.')).toBeVisible();
  await page.screenshot({ path: 'captures/p071/checkout-form.png', fullPage: true });
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);

  // Next time: the saved address is a card.
  await addDishes();
  await expect(page.getByText('12 Jetty Road, Glenelg 5045')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
  await page.screenshot({ path: 'captures/p071/checkout-saved.png', fullPage: true });

  // The kitchen's team sees it.
  await page.goto('/seller/orders');
  await page
    .getByRole('searchbox')
    .or(page.getByRole('button', { name: 'Search orders' }))
    .first()
    .click();
  await page.getByRole('searchbox').fill(firstName);
  await page.getByText(firstName).first().click();
  await expect(page.getByText('12 Jetty Road, Glenelg 5045')).toBeVisible();
  await expect(page.getByText(/blue gate/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Directions' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=12%20Jetty%20Road%2C%20Glenelg%205045',
  );
  await page.goto('/seller/deliveries');
  await expect(page.getByText(firstName)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Directions' }).first()).toBeVisible();
  await page.screenshot({ path: 'captures/p071/seller-deliveries.png', fullPage: true });
});
