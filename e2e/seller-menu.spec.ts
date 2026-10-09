import { expect, test, type Page } from '@playwright/test';
import { collectErrors, isDesktopProject } from './sellerHelpers';

// The menu editor through its harness (6.3 adds the routes). It works on the second sample seller
// (Dapur Demo), not the default one, so other specs keep their menu; everything it adds it removes
// again, and it never orders anything, so no portion limit is touched. The mock store is shared by
// the parallel projects: names are unique per project and the checks are relative.

const SELLER = 'dapur-demo';

// All tests here change the same menu, so they run one after another (and the config runs this
// file's projects one after another too): neighbours moving in or out would shift the positions.
test.describe.configure({ mode: 'serial' });
const POST = `Halo semuanya! Menu hari Sabtu:

1. Nasi uduk spesial – $13
2. Sambal terasi, 1 botol – $4.50

Kirim nomor pesanan ya. Terima kasih!`;

async function openMenu(page: Page) {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
  await page.goto('/?harness=seller-menu&screen=menu');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Menu · Sat 10 Oct');
}

/** The names of the items on the menu, top to bottom (a table on a desktop, a list on a phone). */
/** Opens the editor: a click on the table row, or the row's edit button on a phone. */
async function openItem(page: Page, desktop: boolean, name: string) {
  await (
    desktop
      ? page.getByRole('row', { name: new RegExp(name) }).first()
      : page.getByRole('button', { name: `Edit ${name}` })
  ).click();
}

async function itemNames(page: Page, desktop: boolean): Promise<Array<string>> {
  const rows = desktop
    ? page.getByRole('table', { name: 'Menu items' }).getByRole('row')
    : page.getByRole('list', { name: 'Menu items' }).getByRole('listitem');
  return (await rows.allTextContents()).map((text) => text);
}

function itemRow(page: Page, desktop: boolean, name: string) {
  return desktop
    ? page.getByRole('row', { name: new RegExp(name) })
    : page.getByRole('listitem').filter({ hasText: name });
}

test('add an item, edit its price, move it, then remove it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('mobile-webkit'), 'desktop and Android only');
  const errors = collectErrors(page);
  const desktop = isDesktopProject(testInfo.project.name);
  const name = `Spec dish ${testInfo.project.name} ${String(Date.now())}`;
  await openMenu(page);
  await page.screenshot({
    path: `captures/seller-menu-menu-${testInfo.project.name}.png`,
    fullPage: true,
  });

  // Add.
  await page.getByRole('button', { name: '+ Add item' }).click();
  await page.getByLabel('Name (English)').fill(name);
  await page.getByLabel('Price (AUD)').fill('10,50');
  await page.screenshot({
    path: `captures/seller-menu-item-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(itemRow(page, desktop, name)).toContainText('$10.50');

  // Edit the price.
  await openItem(page, desktop, name);
  await expect(page.getByLabel('Price (AUD)')).toHaveValue('10.50');
  await page.getByLabel('Price (AUD)').fill('12');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(itemRow(page, desktop, name)).toContainText('$12.00');

  // Move it up one place, and back.
  const before = (await itemNames(page, desktop)).findIndex((text) => text.includes(name));
  await page.getByRole('button', { name: `Move ${name} up` }).click();
  await expect
    .poll(async () => (await itemNames(page, desktop)).findIndex((text) => text.includes(name)))
    .toBe(before - 1);
  await page.getByRole('button', { name: `Move ${name} down` }).click();
  await expect
    .poll(async () => (await itemNames(page, desktop)).findIndex((text) => text.includes(name)))
    .toBe(before);

  // Remove it again (second tap confirms).
  await openItem(page, desktop, name);
  await page.getByRole('button', { name: 'Delete item' }).click();
  await page.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(itemRow(page, desktop, name)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('paste a WhatsApp post and use its 2 items', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('mobile-webkit'), 'desktop and Android only');
  const errors = collectErrors(page);
  const desktop = isDesktopProject(testInfo.project.name);
  await openMenu(page);
  await page.getByRole('button', { name: 'Paste a WhatsApp post' }).click();
  await page.getByLabel('Paste your WhatsApp post').fill(POST);
  await page.getByRole('button', { name: 'Read items' }).click();
  await expect(page.getByText('Found 2 items')).toBeVisible();
  await expect(page.getByText("These lines weren't read:")).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Kirim nomor pesanan ya. Terima kasih!' }),
  ).toBeVisible();
  await page.screenshot({
    path: `captures/seller-menu-paste-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Use these 2 items' }).click();

  // Back on the menu with the two new items; remove them again.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Menu · Sat 10 Oct');
  for (const dish of ['Nasi uduk spesial', 'Sambal terasi']) {
    await expect(itemRow(page, desktop, dish).first()).toBeVisible();
  }
  for (const dish of ['Nasi uduk spesial', 'Sambal terasi']) {
    await openItem(page, desktop, dish);
    await page.getByRole('button', { name: 'Delete item' }).click();
    await page.getByRole('button', { name: 'Tap again to delete' }).click();
    await expect(itemRow(page, desktop, dish)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('save this week as a set, then delete the set', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('mobile-webkit'), 'desktop and Android only');
  const errors = collectErrors(page);
  const setName = `Set ${testInfo.project.name.replace('settings-', '')} ${String(Date.now())}`;
  await openMenu(page);
  await page.getByRole('button', { name: 'Saved sets' }).click();
  await expect(page.getByRole('heading', { name: 'Saved sets' })).toBeVisible();
  await page.getByLabel('Set name').fill(setName);
  await page.getByRole('button', { name: 'Save set' }).click();
  await expect(page.getByText('Set saved')).toBeVisible();
  const card = page.getByRole('listitem').filter({ hasText: setName });
  await expect(card).toContainText(/\d+ items? · \d+ images?/);
  await page.screenshot({
    path: `captures/seller-menu-sets-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await card.getByRole('button', { name: 'Delete' }).click();
  await card.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(page.getByText('Set deleted')).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});
