import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// The customer app behaves like a native app on a phone: the menu home with the kitchen's picture,
// a bottom tab bar on the three root pages only, a Back button with the previous page's name on
// every pushed page, and Settings holding language and theme.
test('the customer app: menu, basket, order, then Settings and the Indonesian menu', async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('desktop'), 'phone projects only');
  test.setTimeout(90_000);
  const project = testInfo.project.name;
  const errors = collectErrors(page);
  const tabs = page.getByRole('navigation', { name: 'Customer' });
  const firstName = `Native-${Date.now()}`;

  await markHowItWorksSeen(context);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/onde-onde');
  const banner = page.getByRole('img', { name: 'Onde Onde — Indonesian homemade food' });
  await expect(banner).toBeVisible();
  // The banner sits at the top of the page, full width, with nothing above it.
  const bannerBox = await banner.boundingBox();
  const viewport = page.viewportSize();
  expect(bannerBox?.y ?? 99).toBeLessThanOrEqual(1);
  expect(bannerBox?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2);
  await expect(page.getByRole('heading', { name: 'Onde Onde' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^Back/ })).toHaveCount(0);
  await page.screenshot({ path: `captures/native-menu-${project}.png` });

  // Dishes: pushed on the menu (Back names it), the Menu tab stays current; the basket bar sits
  // above the tab bar.
  await page.getByRole('button', { name: 'See dishes and order' }).click();
  await expect(page).toHaveURL(/\/onde-onde\/dishes$/);
  await expect(page.getByRole('button', { name: 'Back to Menu' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await expect(page.getByText(/^1 item/)).toBeVisible();
  const basketBar = page.getByRole('button', { name: /View basket/ });
  const barBox = await basketBar.boundingBox();
  const tabsBox = await tabs.boundingBox();
  expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeLessThanOrEqual(tabsBox?.y ?? 0);
  await basketBar.click();
  await expect(page).toHaveURL(/\/basket$/);
  // Checkout pages hide the tab bar.
  await expect(tabs).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your basket' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Dishes' })).toBeVisible();
  await page.screenshot({ path: `captures/native-basket-${project}.png` });
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await expect(page).toHaveURL(/\/basket\/name$/);
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);

  // The order page keeps My orders active.
  await page.getByRole('button', { name: 'Change or cancel' }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+$/);
  await expect(tabs.getByRole('link', { name: 'My orders' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.screenshot({ path: `captures/native-order-${project}.png` });

  // Back from the order page goes to My orders, a root page with the tab bar and no Back.
  await page.getByRole('button', { name: 'Back to My orders' }).click();
  await expect(page).toHaveURL(/\/my-orders$/);
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Back/ })).toHaveCount(0);
  await expect(tabs.getByRole('link', { name: 'My orders' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveCount(0);
  await page.screenshot({ path: `captures/native-orders-${project}.png` });

  // Settings: light and dark captures, then switch to Indonesian.
  await tabs.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.screenshot({ path: `captures/native-settings-${project}.png`, fullPage: true });
  await page.screenshot({ path: `captures/native-light-${project}.png` });
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveCSS('color-scheme', /dark/);
  await page.screenshot({ path: `captures/native-dark-${project}.png` });
  await page.getByRole('radio', { name: 'Auto' }).click();

  await page.getByRole('radio', { name: 'ID' }).click();
  await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
  await page.getByRole('link', { name: 'Menu' }).click();
  await expect(page.getByText('Masakan rumahan Indonesia')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Pelanggan' }).getByRole('link', { name: 'Pesanan saya' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
