import { expect, test, type Page } from '@playwright/test';
import { collectErrors, isDesktopProject } from './sellerHelpers';

// Stage 6.3: the batch 3 screens through the app's real routes (menu, preview as customer, More,
// pictures, labels, backup). It changes the second sample seller (Dapur Demo) only, so other specs
// keep Onde Onde's menu; the one item it adds it removes again, and it never orders anything.

const SELLER = 'dapur-demo';

async function open(page: Page, path: string) {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
  await page.goto(path);
}

/** Opens the editor of a dish: a click on the table row, or the row's edit button on a phone. */
async function openItem(page: Page, desktop: boolean, name: string) {
  await (
    desktop
      ? page.getByRole('row', { name: new RegExp(name) }).first()
      : page.getByRole('button', { name: `Edit ${name}` })
  ).click();
}

test('menu, preview as customer, then More: pictures, labels and backup', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.endsWith('mobile-webkit'), 'desktop and Android only');
  const errors = collectErrors(page);
  const desktop = isDesktopProject(testInfo.project.name);
  const project = testInfo.project.name;
  const name = `B3 dish ${project} ${String(Date.now())}`;
  const seller = page.getByRole('navigation', { name: 'Seller' });

  // Menu: add an item through its route, open its editor and close it again.
  await open(page, '/seller');
  await seller.getByRole('link', { name: 'Menu' }).click();
  await expect(page).toHaveURL(/\/seller\/menu$/);
  await expect(seller.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Menu ·');
  await page.getByRole('button', { name: '+ Add item' }).click();
  await expect(page).toHaveURL(/\/seller\/menu\/items\/new$/);
  await page.getByLabel('Name (English)').fill(name);
  await page.getByLabel('Price (AUD)').fill('9');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/menu$/);
  await openItem(page, desktop, name);
  await expect(page).toHaveURL(/\/seller\/menu\/items\/[^/]+$/);
  await expect(page.getByLabel('Name (English)')).toHaveValue(name);
  await page.screenshot({ path: `captures/b3-editor-${project}.png`, fullPage: true });
  await page.getByRole('button', { name: desktop ? 'Close' : 'Back' }).click();
  await expect(page).toHaveURL(/\/seller\/menu$/);

  // Preview as customer: the seller bar is on top, ordering is off, the new item is in it.
  await page.getByRole('button', { name: 'Preview as customer' }).click();
  await expect(page).toHaveURL(/\/seller\/menu\/preview$/);
  await expect(page.getByRole('region', { name: /Preview/ })).toBeVisible();
  await expect(page.getByText(/^Preview · (not published yet|published)$/)).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
  const plus = page.getByRole('button', { name: `Add one ${name}` });
  await expect(plus).toBeDisabled();
  await expect(page.getByRole('button', { name: /View basket/ })).toHaveCount(0);
  await page.screenshot({ path: `captures/b3-preview-${project}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to editing' }).click();
  await expect(page).toHaveURL(/\/seller\/menu$/);

  // Remove the item again.
  await openItem(page, desktop, name);
  await page.getByRole('button', { name: 'Delete item' }).click();
  await page.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(page.getByText(name)).toHaveCount(0);

  // More: the list, then pictures (five slots), labels (the preview) and backup.
  await seller.getByRole('link', { name: 'More' }).click();
  await expect(page).toHaveURL(/\/seller\/more$/);
  await page.screenshot({ path: `captures/b3-more-${project}.png`, fullPage: true });

  await page.getByRole('button', { name: /^Pictures/ }).click();
  await expect(page).toHaveURL(/\/seller\/images$/);
  for (const slot of [
    'Wide banner (tablet and computer)',
    'Phone banner',
    'Menu image (left menu)',
    'Small icon (closed menu)',
    'Background (wide screens)',
  ]) {
    await expect(page.getByRole('heading', { name: slot })).toBeVisible();
  }
  await expect(seller.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: `captures/b3-images-${project}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Back to More' }).click();
  await page.getByRole('button', { name: /^Labels/ }).click();
  await expect(page).toHaveURL(/\/seller\/labels$/);
  await expect(page.getByText(/^Preview · /)).toBeVisible();
  await page.screenshot({ path: `captures/b3-labels-${project}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Back to More' }).click();
  await page.getByRole('button', { name: /^Backup/ }).click();
  await expect(page).toHaveURL(/\/seller\/backup$/);
  await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
  await page.screenshot({ path: `captures/b3-backup-${project}.png`, fullPage: true });

  expect(errors).toEqual([]);
});
