import { expect, test, type Page } from '@playwright/test';

// This spec briefly closes ordering on the shared mock server, which would break any spec placing
// orders at the same time. playwright.config.ts runs it in its own projects, after all the others,
// one at a time; `serial` keeps its tests in order inside a file.
test.describe.configure({ mode: 'serial' });

function watchConsole(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
test('settings saves the WhatsApp number normalised; Orders pauses and resumes taking orders', async ({
  page,
  request,
}, testInfo) => {
  const errors = watchConsole(page);
  try {
    await page.goto('/seller/settings/kitchen');
    const number = page.getByLabel('WhatsApp number');
    await number.fill('0412 345 678');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(number).toHaveValue('+61 412 345 678');

    await page.reload();
    await expect(page.getByLabel('WhatsApp number')).toHaveValue('+61 412 345 678');
    await page.screenshot({
      path: `captures/seller-tools-settings-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // The ordering switch is "Taking orders" on Orders now: pause, then resume (other tests share
    // this server).
    await page.goto('/seller');
    const taking = page.getByRole('switch', { name: 'Taking orders' });
    await expect(taking).toHaveAttribute('aria-checked', 'true');
    await taking.click();
    const paused = page.getByRole('switch', { name: 'Paused' });
    await expect(paused).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Paused' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.getByRole('switch', { name: 'Paused' }).click();
    await expect(page.getByRole('switch', { name: 'Taking orders' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  } finally {
    await request.put('/api/seller/menus/current', {
      headers: { 'X-Seller': 'onde-onde' },
      data: { takingOrders: true },
    });
  }
  expect(errors).toEqual([]);
});
