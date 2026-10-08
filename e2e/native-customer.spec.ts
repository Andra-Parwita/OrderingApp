import { expect, test } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Stage 4.10 (D-039): the customer app behaves like a native app on a phone: banner on top, a
// bottom tab bar, the language toggle beside the name, and Settings holding language and theme.
test('the customer app: menu, basket, order, then Settings and the Indonesian menu', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('desktop'), 'phone projects only');
  test.setTimeout(90_000);
  const project = testInfo.project.name;
  const errors = collectErrors(page);
  const tabs = page.getByRole('navigation', { name: 'Customer' });
  const firstName = `Native-${Date.now()}`;

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/onde-onde');
  const banner = page.getByRole('img', { name: 'Onde Onde — Indonesian homemade food' });
  await expect(banner).toBeVisible();

  // The very first element in the page is the banner image; nothing sits above it.
  const first = await page.evaluate(() => {
    const element = document.querySelector('#root')?.querySelector('*:not(div):not(main)');
    return element?.tagName ?? null;
  });
  expect(first).toBe('IMG');
  const bannerTop = await banner.evaluate((img) => img.getBoundingClientRect().top);
  expect(bannerTop).toBeLessThanOrEqual(1);
  // The name has the EN / ID toggle beside it (same row).
  const name = page.getByRole('heading', { name: 'Onde Onde' });
  const toggle = page.getByRole('radiogroup', { name: 'Language' });
  const nameBox = await name.boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(Math.abs((toggleBox?.y ?? 0) - (nameBox?.y ?? 99))).toBeLessThan(40);
  expect((toggleBox?.x ?? 0) > (nameBox?.x ?? 999)).toBe(true);
  await expect(page.getByRole('button', { name: 'My orders' })).toHaveCount(0);
  await expect(tabs.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: `captures/native-menu-${project}.png` });

  // Basket (Menu tab stays current), then place the order.
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await expect(page.getByText(/^1 item/)).toBeVisible();
  const basketBar = page.getByRole('button', { name: /View basket/ });
  const barBox = await basketBar.boundingBox();
  const tabsBox = await tabs.boundingBox();
  expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeLessThanOrEqual(tabsBox?.y ?? 0);
  await basketBar.click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(tabs.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
  // Native-style header: Back, the title, and a compact language switch on the right.
  const header = page.locator('header', {
    has: page.getByRole('heading', { name: 'Your basket' }),
  });
  await expect(header.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(header.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
  await page.screenshot({ path: `captures/native-basket-${project}.png` });
  await page.getByLabel('Your first name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  await expect(tabs.getByRole('link', { name: 'My orders' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // The order page keeps My orders active.
  await page.getByRole('button', { name: 'Change or cancel order' }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+$/);
  await expect(tabs.getByRole('link', { name: 'My orders' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
  await page.screenshot({ path: `captures/native-order-${project}.png` });

  // Back from the order page goes to My orders, which is a tab root with no Back.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/my-orders$/);
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveCount(0);
  await page.screenshot({ path: `captures/native-orders-${project}.png` });

  // Settings: light and dark captures, then switch to Indonesian.
  await tabs.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn on updates' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'iPhone (Safari)' })).toBeVisible();
  await page.screenshot({ path: `captures/native-settings-${project}.png`, fullPage: true });
  await page.screenshot({ path: `captures/native-light-${project}.png` });
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveCSS('color-scheme', /dark/);
  await page.screenshot({ path: `captures/native-dark-${project}.png` });
  await page.getByRole('radio', { name: 'Match device' }).click();

  await page.getByRole('radio', { name: 'ID' }).click();
  await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
  await page.getByRole('link', { name: 'Menu' }).click();
  await expect(page.getByText('Masakan rumahan Indonesia')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Pelanggan' }).getByRole('link', { name: 'Pesanan saya' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
