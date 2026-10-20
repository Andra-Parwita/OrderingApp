import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors, orderRow, searchFor } from './sellerHelpers';

// Plan 111: a dish with choices ("Aneka Snack Kering": Kripik Sukun limit 2, Sarang Madu). The seller
// API sets it up (the dev server has no seller login), the customer picks per choice in the sheet,
// adds a note to one basket line, orders; the seller's order shows the choice and the note.
// The shared store is never reset: the dish is found or created, the order is found by a unique name.
test.use({ viewport: { width: 390, height: 844 } });

const DISH = 'Aneka Snack Kering';
const NOTE = 'extra crispy please';

type MenuItems = { items: Array<{ id: string; name: { en: string }; groupId?: string }> };

test('pick choices in the sheet, note one line, and the seller sees both on the order', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
  const errors = collectErrors(page);
  const firstName = `Choice-${Date.now()}`;

  // Setup: the dish with two choices, on the current menu (once; later runs reuse it).
  const menu = async () =>
    ((await (await request.get('/api/seller/menu')).json()) as MenuItems).items;
  let createdDishId: string | null = null;
  if (!(await menu()).some((item) => item.name.en === DISH && !item.groupId)) {
    const made = await request.post('/api/seller/dishes', {
      data: {
        name: { en: DISH, id: DISH },
        priceCents: 600,
        size: { en: '1 Pack', id: '1 Bungkus' },
        choices: [
          { name: { en: 'Kripik Sukun', id: 'Kripik Sukun' }, limit: 2 },
          { name: { en: 'Sarang Madu', id: 'Sarang Madu' }, limit: null },
        ],
      },
    });
    expect(made.ok()).toBe(true);
    createdDishId = ((await made.json()) as { dish: { id: string } }).dish.id;
    const added = await request.post('/api/seller/menus/current/items', {
      data: { dishId: createdDishId },
    });
    expect(added.ok()).toBe(true);
  }

  try {
    // Customer: the dish is one card; + opens the choice sheet.
    await markHowItWorksSeen(page.context());
    await page.goto('/onde-onde/dishes');
    await page.getByRole('button', { name: `Add one ${DISH}` }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Kripik Sukun')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Add 0 to basket · $0.00' })).toBeDisabled();

    const moreSukun = sheet.getByRole('button', { name: 'Add one Kripik Sukun' });
    await moreSukun.click();
    await moreSukun.click();
    await expect(moreSukun).toBeDisabled(); // the limit of 2
    await sheet.getByRole('button', { name: 'Add one Sarang Madu' }).click();
    await sheet.getByRole('button', { name: 'Add 3 to basket · $18.00' }).click();
    await expect(sheet).toBeHidden();

    // Basket: a note on the Sarang Madu line, through the pencil.
    await page.getByRole('button', { name: /View basket/ }).click();
    await expect(page).toHaveURL(/\/basket$/);
    await page.getByRole('button', { name: `Add a note for ${DISH} · Sarang Madu` }).click();
    const noteSheet = page.getByRole('dialog', { name: `Note for ${DISH} · Sarang Madu` });
    await noteSheet.getByLabel('Note').fill(NOTE);
    await noteSheet.getByRole('button', { name: 'Save note' }).click();
    await expect(noteSheet).toBeHidden();
    await expect(page.getByText(NOTE)).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Change the note for ${DISH} · Sarang Madu` }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Next: your name/ }).click();
    await expect(page).toHaveURL(/\/basket\/name$/);
    await page.getByLabel('First name').fill(firstName);
    await page.getByRole('button', { name: /^Place order/ }).click();
    await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);

    // Seller: the order's lines name the choice and carry the note.
    await page.goto('/seller/orders');
    await searchFor(page, firstName);
    await orderRow(page, new RegExp(firstName)).click();
    await expect(page.getByText(/Sarang Madu/).first()).toBeVisible();
    await expect.soft(page.getByText(`${DISH} · Sarang Madu`).first()).toBeVisible();
    await expect(page.getByText(/Kripik Sukun/).first()).toBeVisible();
    await expect(page.getByText(NOTE).first()).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    // The menu keeps its own copy (orders may point at it); only a dish this run made is dropped
    // from the library.
    if (createdDishId) await request.delete(`/api/seller/dishes/${createdDishId}`);
  }
});
