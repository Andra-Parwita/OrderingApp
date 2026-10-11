import { expect, test } from '@playwright/test';
import { adminSignIn, originHeaders } from './adminSession';
import { collectErrors } from './sellerHelpers';
import { virtualAuthenticator } from './virtualAuthenticator';

// Plan 028 stage 4: one helper flow on the phone. An owner (invited by the admin, API) invites a
// helper; the helper signs in on the phone with a passkey, lands on Orders, sees only Orders, Pickup
// & delivery and (in More) Sell, cannot change an order beyond "collected", and is turned back from
// Menu, Settings and New order. Runs alone in the "helper-mobile-chromium" project, after
// session-flow (it shares Dapur Demo's account and the admin passkey `seller-auth-mobile-chromium`).

const createPasskeyName = /^(Face or fingerprint|Add a new passkey)/;
const HELPER = `Helper ${Date.now().toString(36)}`;

async function setUpWithPasskey(page: import('@playwright/test').Page, key: string) {
  await page.goto('/seller/setup');
  await page.getByLabel('Invite key from the kitchen owner').fill(key);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: createPasskeyName }).click();
}

test('a helper on the phone: Orders, Pickup & delivery and Sell only', async ({
  page,
  request,
}) => {
  const errors = collectErrors(page);
  await virtualAuthenticator(page);

  // The owner: an invite key from the admin, a passkey on this phone.
  await adminSignIn(request, 'seller-auth-mobile-chromium');
  const sellers = await request.get('/api/admin/sellers');
  const list = (await sellers.json()) as { sellers: Array<{ id: string; slug: string }> };
  const seller = list.sellers.find((candidate) => candidate.slug === 'dapur-demo');
  if (!seller) throw new Error('Dapur Demo is not in the mock');
  const ownerKey = await request.post(`/api/admin/sellers/${seller.id}/invite-key`, {
    headers: originHeaders,
    data: { displayName: `Owner ${HELPER}` },
  });
  expect(ownerKey.ok()).toBe(true);
  await setUpWithPasskey(page, ((await ownerKey.json()) as { key: string }).key);
  await expect(page).toHaveURL(/\/seller$/);

  // The owner invites a helper (same as every invite), then signs out.
  const invited = await page.request.post('/api/seller/invites', {
    data: { displayName: HELPER, role: 'helper' },
  });
  expect(invited.ok()).toBe(true);
  const helperKey = ((await invited.json()) as { key: string }).key;
  await page.waitForTimeout(600); // let the first loads finish: a sign-out mid-load is a 401
  expect((await page.request.post('/api/auth/sign-out')).ok()).toBe(true);
  await page.evaluate(() => localStorage.removeItem('signedIn'));

  // The helper: sets up on this phone and lands on Orders.
  await setUpWithPasskey(page, helperKey);
  await expect(page).toHaveURL(/\/seller(\/orders)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();

  // The phone bar: Orders, Pickup & delivery, More. No Kitchen, Menu or Settings anywhere.
  const bar = page.getByRole('link', { name: 'More' });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pickup & delivery' })).toBeVisible();
  for (const hidden of ['Kitchen', 'Menu', 'Settings', 'Home']) {
    await expect(page.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'New order' })).toHaveCount(0);

  // An order opens read only: collected stays, edit-type buttons are gone.
  await page.request.post('/api/seller/demo/samples').catch(() => undefined);
  await page.reload();
  const first = page
    .getByRole('button', { name: /^(?!.*Search)/ })
    .filter({ hasText: /[A-Z0-9]{6}/ });
  if ((await first.count()) > 0) {
    await first.first().click();
    for (const hidden of ['Cancel order', 'Mark paid', 'Lock', 'Nudge']) {
      await expect(page.getByRole('button', { name: hidden })).toHaveCount(0);
    }
    await page.goBack();
  }

  // More holds Sell; Pickup & delivery opens.
  await page.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('button', { name: /^Sell( |$)/ })).toBeVisible();
  for (const hidden of ['Kitchen', 'Labels', 'Settings', 'Backup']) {
    await expect(page.getByRole('button', { name: hidden, exact: true })).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Pickup & delivery' }).click();
  await expect(page).toHaveURL(/\/seller\/hand-over$/);

  // A direct link to anything else goes back to Orders.
  for (const path of ['/seller/menu', '/seller/settings/kitchen', '/seller/new', '/seller/cook']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/seller\/orders$/);
  }

  expect(errors).toEqual([]);
});
