import { expect, test } from '@playwright/test';

test('hello screen loads, shows health ok and switches language', async ({ page }, testInfo) => {
  const consoleErrors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Weekly Menu' })).toBeVisible();
  await expect(page.getByTestId('health')).toHaveText('ok');

  await page.getByRole('button', { name: 'ID' }).click();
  await expect(page.getByRole('heading', { name: 'Menu Mingguan' })).toBeVisible();
  await expect(page.getByText('Status server')).toBeVisible();

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly Menu' })).toBeVisible();

  await page.screenshot({ path: `captures/hello-${testInfo.project.name}.png`, fullPage: true });
  expect(consoleErrors).toEqual([]);
});
