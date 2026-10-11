import { expect, test, type Page } from '@playwright/test';
import { adminSignIn, originHeaders } from './adminSession';
import { collectErrors } from './sellerHelpers';

// Plan 030 stage 2: a chef adds a dish and edits it from Menu ("Your dishes"), with no chef picker
// and no owner controls; the owner then sees the dish in Your dishes, assigned to the chef. Desktop
// only. Runs alone in the "chef-dishes-desktop-chromium" project, after helper-flow (it shares Dapur
// Demo's account and the API admin passkey `seller-auth-mobile-chromium`).

const STAMP = Date.now().toString(36);
const OWNER = `Owner ${STAMP}`;
const CHEF = `Chef ${STAMP}`;
const PASSWORD = 'chef dishes long password';
const DISH = `Pastel ${STAMP}`;

async function setUpWithPassword(page: Page, key: string, device: string) {
  await page.goto('/seller/setup');
  await page.getByLabel('Invite key from the kitchen owner').fill(key);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Set a password/ }).click();
  await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Name of this device').fill(device);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/seller(\/orders)?$/);
}

test('a chef adds and edits their own dish', async ({ page, request }) => {
  const errors = collectErrors(page);

  // The owner: invite key from the admin (API), set up with a password.
  await adminSignIn(request, 'seller-auth-mobile-chromium');
  const list = (await (await request.get('/api/admin/sellers')).json()) as {
    sellers: Array<{ id: string; slug: string }>;
  };
  const seller = list.sellers.find((candidate) => candidate.slug === 'dapur-demo');
  if (!seller) throw new Error('Dapur Demo is not in the mock');
  const ownerKey = await request.post(`/api/admin/sellers/${seller.id}/invite-key`, {
    headers: originHeaders,
    data: { displayName: OWNER },
  });
  expect(ownerKey.ok()).toBe(true);
  await setUpWithPassword(page, ((await ownerKey.json()) as { key: string }).key, 'E2E owner');

  // The owner makes a chef and invites them, then signs out.
  const made = await page.request.post('/api/seller/chefs', { data: { name: CHEF } });
  expect(made.ok()).toBe(true);
  const { chef } = (await made.json()) as { chef: { id: string } };
  const invited = await page.request.post('/api/seller/chef-invites', {
    data: { chefId: chef.id },
  });
  expect(invited.ok()).toBe(true);
  const chefKey = ((await invited.json()) as { key: string }).key;
  await page.waitForTimeout(600); // let the first loads finish: a sign-out mid-load is a 401
  expect((await page.request.post('/api/auth/sign-out')).ok()).toBe(true);
  await page.evaluate(() => localStorage.removeItem('signedIn'));

  // The chef: Menu is in the rail and opens Your dishes only.
  await setUpWithPassword(page, chefKey, 'E2E chef');
  const rail = page.getByRole('navigation', { name: 'Seller' });
  await rail.getByRole('link', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your dishes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New menu' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Saved sets/ })).toHaveCount(0);

  // Add a dish: the editor has no chef picker and no "add to this menu".
  await page.getByRole('button', { name: 'New dish' }).click();
  await expect(page.getByLabel('Chef', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Add to this menu too')).toHaveCount(0);
  await page.getByLabel('Name (English)').fill(DISH);
  await page.getByLabel('Price (AUD)').fill('12');
  await page.getByRole('button', { name: 'Add dish' }).click();
  await expect(page.getByText(DISH, { exact: true })).toBeVisible();

  // Edit it: the new price shows in the list.
  await page.getByRole('button', { name: `Edit ${DISH}` }).click();
  await page.getByLabel('Price (AUD)').fill('14');
  await page.getByRole('button', { name: 'Save dish' }).click();
  await expect(page.getByText(/14[.,]00/)).toBeVisible();

  // The chef's session cannot publish, whatever the page says.
  expect((await page.request.post('/api/seller/menus/current/publish')).status()).toBe(403);

  // The dish is stored with this chef (the server forces it).
  const dishes = await page.request.get('/api/seller/dishes');
  const found = (
    (await dishes.json()) as { dishes: Array<{ name: { en: string }; chefId?: string }> }
  ).dishes.find((dish) => dish.name.en === DISH);
  expect(found?.chefId).toBe(chef.id);

  expect(errors).toEqual([]);
});
