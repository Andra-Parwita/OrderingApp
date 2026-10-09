import { expect, test, type Page } from '@playwright/test';
import { collectErrors, sampleDay } from './sellerHelpers';

// The menu screens on their real routes (plan 001 stage 7): Your dishes, the dish editor, the live
// menu's tabs and Saved sets. It works on the second sample seller (Dapur Demo), not the default
// one, so other specs keep their menu; the dish it adds it removes again, and it never orders
// anything, so no portion limit is touched. Menu is a tablet and computer screen (a phone shows
// "Open this on a tablet or computer"), so only the desktop project runs it. The mock store is
// shared by the projects: names are unique per project and the checks are relative.

const SELLER = 'dapur-demo';

// All tests here change the same menu, so they run one after another (and the config runs this
// file's projects one after another too).
test.describe.configure({ mode: 'serial' });
test.skip(({ viewport }) => (viewport?.width ?? 0) < 600, 'tablet and desktop only');

async function open(page: Page, path: string) {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
  await page.goto(path);
}

test('add a dish, edit its price, change it on the menu, then remove it', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  const name = `Spec dish ${testInfo.project.name} ${String(Date.now())}`;
  const dishes = page.getByRole('table', { name: 'Dishes on the live menu' });

  // Add (it goes on the live menu too: the box is ticked).
  await open(page, '/seller/menu/dishes');
  await expect(page.getByRole('heading', { level: 1, name: 'Your dishes' })).toBeVisible();
  await page.screenshot({
    path: `captures/seller-menu-dishes-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'New dish' }).click();
  const editor = page.getByRole('dialog', { name: 'New dish' });
  await editor.getByLabel('Name (English)').fill(name);
  await editor.getByLabel('Price (AUD)').fill('10,50');
  await page.screenshot({
    path: `captures/seller-menu-dish-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await editor.getByRole('button', { name: 'Add dish' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible();

  // It is on the live menu with that price.
  await page.goto('/seller/menu');
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible();
  await expect(page.getByText(`Live menu`)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: sampleDay() }).first()).toBeVisible();
  await expect(dishes.getByRole('row', { name: new RegExp(name) })).toContainText('$10.50');

  // Edit the price of the menu's copy in Prices & limits (instant), the library keeps its own.
  await page.goto('/seller/menu/edit/prices');
  const price = page.getByLabel(`Price of ${name}`);
  await price.fill('12');
  await price.blur();
  await page.goto('/seller/menu');
  await expect(dishes.getByRole('row', { name: new RegExp(name) })).toContainText('$12.00');

  // Edit the dish in Your dishes.
  await page.goto('/seller/menu/dishes');
  await page.getByRole('button', { name: `Edit ${name}` }).click();
  await expect(page.getByLabel('Price (AUD)')).toHaveValue('10.50');
  await page.getByLabel('Price (AUD)').fill('11');
  await page.getByRole('button', { name: 'Save dish' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Take it off the live menu, then out of Your dishes (the warning asks first).
  await page.goto('/seller/menu/edit/dishes');
  await page.getByRole('button', { name: `Remove ${name} from this menu` }).click();
  await expect(page.getByRole('button', { name: `Remove ${name} from this menu` })).toHaveCount(0);
  await page.goto('/seller/menu/dishes');
  await page.getByRole('button', { name: `Edit ${name}` }).click();
  await page.getByRole('button', { name: 'Delete dish' }).click();
  await page.getByRole('button', { name: 'Delete anyway' }).click();
  await expect(page.getByRole('button', { name: `Edit ${name}` })).toHaveCount(0);
  await page.goto('/seller/menu');
  await expect(dishes.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('save the menu as a set, and find it in Saved sets', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  const setName = `Set ${testInfo.project.name.replace('settings-', '')} ${String(Date.now())}`;
  await open(page, '/seller/menu/edit/dishes');
  await page.getByRole('button', { name: 'Save these as a set' }).click();
  await page.getByLabel('Set name').fill(setName);
  await page.getByRole('button', { name: 'Save set' }).click();
  await expect(page.getByText('Set saved.')).toBeVisible();

  // Saved sets lists it with its dishes. (Sets cannot be deleted yet, so the spec adds just one.)
  await page.goto('/seller/menu/sets');
  await expect(page.getByRole('heading', { level: 1, name: 'Saved sets' })).toBeVisible();
  await expect(page.getByText(setName, { exact: true })).toBeVisible();
  await page.screenshot({
    path: `captures/seller-menu-sets-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
