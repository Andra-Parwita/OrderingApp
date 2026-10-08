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
test('settings saves the WhatsApp number normalised and the ordering switch', async ({
  page,
  request,
}, testInfo) => {
  const errors = watchConsole(page);
  try {
    await page.goto('/seller/settings');
    const number = page.getByLabel('Your WhatsApp number');
    await number.fill('0412 345 678');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(number).toHaveValue('+61 412 345 678');

    await page.reload();
    await expect(page.getByLabel('Your WhatsApp number')).toHaveValue('+61 412 345 678');
    await page.screenshot({
      path: `captures/seller-tools-settings-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Closed, saved; then Open again (other tests share this server).
    await page.getByRole('radio', { name: 'Closed', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Closed', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: 'Open', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('radio', { name: 'Open', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  } finally {
    const current = await request.get('/api/seller/settings');
    const { settings } = (await current.json()) as { settings: Record<string, unknown> };
    await request.put('/api/seller/settings', { data: { ...settings, orderingOpen: true } });
  }
  expect(errors).toEqual([]);
});
