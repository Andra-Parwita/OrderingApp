import { expect, test } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 109: the Kitchen list preview. Dapur Demo's existing orders are used (run after the sample-order specs); the
// preview shows the header, a row per dish with its count and "for N people", and the choices
// (notes, private) are remembered on the device. Notes and per-chef maths are in the unit tests.

const SELLER = 'dapur-demo';

test.skip(({ viewport }) => (viewport?.width ?? 0) < 600, 'desktop only');

test('Print kitchen list opens a preview with the dishes and remembers the ticks', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1138, height: 640 },
  });
  try {
    await context.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto('/seller/cook');
    await page.getByRole('button', { name: 'Print kitchen list' }).click();
    await expect(page).toHaveURL(/\/seller\/cook\/print$/);

    const sheet = page.getByTestId('kitchen-print-page');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Dapur Demo');
    await expect(sheet).toContainText('Menu for');
    await expect(sheet).toContainText('Printed');
    await expect(sheet.getByTestId('kitchen-print-row').first()).toContainText(/for \d+ people?/);

    const notes = page.getByRole('checkbox', { name: 'Include customer notes' });
    await expect(notes).not.toBeChecked();
    await expect(page.getByTestId('kitchen-print-notes')).toHaveCount(0);
    await notes.check();
    await expect(page.getByTestId('kitchen-print-notes')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Include private orders' }).check();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Include customer notes' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Include private orders' })).toBeChecked();
    await page.getByRole('radio', { name: 'Chef' }).click();
    await expect(sheet).toBeVisible();
    await page.screenshot({ path: 'scratch/b109-options.png' });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
