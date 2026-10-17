import { expect, test, type APIRequestContext } from '@playwright/test';
import { markHowItWorksSeen, openDishes } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Plan 067 (D-103): the seller adds a picture to a dish in Your dishes, the customer sees it on the
// dish row and enlarges it. Works on the second sample seller (Dapur Demo) with a dish of its own
// that it removes again; it never orders anything. Like seller-menu it changes the shared live
// menu, so it runs in the settings projects. Tablet and computer (the editor is the same on a phone).

const SELLER = 'dapur-demo';
const HEADERS = { 'X-Seller': SELLER };
// A 1 x 1 PNG: the device crops it square and shrinks it to 600 x 600 before upload.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.skip(({ viewport }) => (viewport?.width ?? 0) < 600, 'tablet and desktop only');

async function removeFromMenuAndLibrary(request: APIRequestContext, dishId: string) {
  const current = (await (
    await request.get('/api/seller/menus/current', { headers: HEADERS })
  ).json()) as { menu: { dishes: Array<{ dishId?: string }> } };
  const others = current.menu.dishes.flatMap((d) =>
    d.dishId && d.dishId !== dishId ? [d.dishId] : [],
  );
  await request.put('/api/seller/menus/current', { headers: HEADERS, data: { dishIds: others } });
  await request.delete(`/api/seller/dishes/${dishId}`, { headers: HEADERS });
}

test('a seller adds a dish picture and the customer sees and enlarges it', async ({
  browser,
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  const name = `Pic dish ${testInfo.project.name} ${String(Date.now())}`;

  // A dish of its own, on the live menu.
  const made = await request.post('/api/seller/dishes', {
    headers: HEADERS,
    data: { name: { en: name, id: name }, priceCents: 1050 },
  });
  expect(made.ok()).toBe(true);
  const dishId = ((await made.json()) as { dish: { id: string } }).dish.id;
  try {
    const added = await request.post('/api/seller/menus/current/items', {
      headers: HEADERS,
      data: { dishId },
    });
    expect(added.ok()).toBe(true);

    // Seller: Your dishes, the dish editor, and add a picture.
    await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
    await page.goto('/seller/menu/dishes');
    await expect(page.getByRole('heading', { level: 1, name: 'Your dishes' })).toBeVisible();
    await page.getByRole('button', { name: `Edit ${name}` }).click();
    const editor = page.getByRole('dialog', { name: `Edit ${name}` });
    await expect(editor.getByRole('button', { name: 'Take photo' })).toBeVisible();
    await editor.locator('input[type="file"]').setInputFiles({
      name: 'dish.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    const thumb = editor.getByRole('img', { name: `Picture of ${name}` });
    await expect(thumb).toBeVisible();
    await expect(thumb).toHaveAttribute('src', /^\/images\/|^data:image\//);
    await expect(editor.getByRole('button', { name: 'Replace' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Customer: the dish row has the picture on the left; a tap enlarges it with the name and price.
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      await markHowItWorksSeen(context);
      const customer = await context.newPage();
      await openDishes(customer, SELLER);
      const enlarge = customer.getByRole('button', { name: `Enlarge picture of ${name}` });
      await expect(enlarge).toBeVisible();
      await expect(enlarge.locator('img')).toHaveAttribute('loading', 'lazy');
      await enlarge.click();
      const viewer = customer.getByRole('dialog', { name: `Picture of ${name}` });
      await expect(viewer).toBeVisible();
      await expect(viewer.getByText(`${name} · $10.50`)).toBeVisible();
      await customer.keyboard.press('Escape');
      await expect(viewer).toBeHidden();
    } finally {
      await context.close();
    }
  } finally {
    await removeFromMenuAndLibrary(request, dishId);
  }
  expect(errors).toEqual([]);
});
