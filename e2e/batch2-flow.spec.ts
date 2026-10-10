import { expect, test, type Page } from '@playwright/test';
import { orderRow, pageScrollWidth, sampleDay, searchBox, searchFor } from './sellerHelpers';

function watchConsole(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// The nudge and lock flow across two devices, on the real routes. The mock store is shared by
// parallel tests: this test never resets it; it finds its own order by a unique name.
test('nudge and lock: seller on a desktop, customer on an iPhone', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit', 'one run, on the iPhone project');
  test.setTimeout(120_000);
  const customerErrors = watchConsole(page);
  const firstName = `Nudge-${Date.now()}`;

  // Customer orders (tempeh has no portion limit, so parallel runs never sell it out).
  await page.goto('/onde-onde');
  await page.getByRole('button', { name: 'Add one Thin battered tempeh' }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByLabel('Your first name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  await page.getByRole('button', { name: 'Change or cancel order' }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+$/);
  await expect(page.getByRole('button', { name: 'Change order' })).toBeVisible();
  await page.screenshot({ path: 'captures/b2flow-1-customer-order.png', fullPage: true });

  const seller = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1280, height: 800 },
  });
  try {
    const sellerPage = await seller.newPage();
    const sellerErrors = watchConsole(sellerPage);

    // Seller (desktop) finds the order and sees it is from a new customer.
    await sellerPage.goto('/seller');
    await expect(sellerPage.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
    await searchFor(sellerPage, firstName);
    const row = orderRow(sellerPage, new RegExp(firstName));
    await row.click();
    await expect(sellerPage).toHaveURL(/\/seller\/orders\/[A-Z0-9]+\?q=/);
    await expect(sellerPage.getByText('★ New customer')).toBeVisible();
    await expect(sellerPage.getByText(/Wait for their WhatsApp message/)).toBeVisible();
    await sellerPage.screenshot({ path: 'captures/b2flow-2-seller-detail.png', fullPage: true });

    // Nudge: the reminder reaches the customer's order page (it polls every 15 s).
    const panel = sellerPage.getByRole('complementary', { name: /^Order / });
    await panel.getByRole('button', { name: 'More', exact: true }).click();
    await sellerPage.getByRole('menuitem', { name: /^Nudge/ }).click();
    await expect(sellerPage.getByText('Reminder sent to the customer')).toBeVisible();
    await expect(page.getByTestId('updates')).toContainText(
      'The seller is waiting for your order number on WhatsApp.',
      { timeout: 40_000 },
    );
    await page.screenshot({ path: 'captures/b2flow-3-customer-nudged.png', fullPage: true });

    // Lock: the customer can no longer change the order.
    await panel.getByRole('button', { name: 'More', exact: true }).click();
    await sellerPage.getByRole('menuitem', { name: /^Lock/ }).click();
    await panel.getByRole('button', { name: 'More', exact: true }).click();
    await expect(sellerPage.getByRole('menuitem', { name: /^Unlock/ })).toBeVisible();
    await sellerPage.keyboard.press('Escape');
    await expect(
      page.getByText('The seller has locked this order. Message them on WhatsApp to change it.'),
    ).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('button', { name: 'Change order' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    await page.screenshot({ path: 'captures/b2flow-4-customer-locked.png', fullPage: true });

    // Seller adds a WhatsApp order for someone else (New order is a slide-over on a desktop).
    await sellerPage
      .getByRole('complementary', { name: /^Order / })
      .getByRole('button', { name: 'Close' })
      .click();
    await sellerPage.getByRole('button', { name: 'New order' }).click();
    await expect(sellerPage).toHaveURL(/\/seller\/new$/);
    const form = sellerPage.getByRole('dialog', { name: 'New order' });
    const walkIn = `Lisa-${Date.now()}`;
    await form.getByLabel('Customer first name').fill(walkIn);
    await form.getByRole('button', { name: 'One more Tilapia pesmol' }).click();
    await form.getByRole('button', { name: 'Create only' }).click();
    await searchFor(sellerPage, walkIn);
    await expect(orderRow(sellerPage, new RegExp(walkIn))).toBeVisible();
    await sellerPage.screenshot({ path: 'captures/b2flow-5-seller-saved.png', fullPage: true });

    expect(sellerErrors).toEqual([]);
  } finally {
    await seller.close();
  }
  expect(customerErrors).toEqual([]);
});

// Every status tab must sit fully inside the list pane (the pane that holds the search).
async function expectTabsInsideList(page: Page, width: number) {
  const group = page.getByRole('group', { name: 'Order status' });
  const tabs = group.getByRole('button');
  await expect(tabs).toHaveCount(6);
  const pane = await page.getByRole('main').boundingBox();
  expect(pane, `list pane at ${width}`).not.toBeNull();
  for (let i = 0; i < 6; i += 1) {
    const tab = tabs.nth(i);
    await expect(tab).toBeVisible();
    const box = await tab.boundingBox();
    expect(box, `tab ${i} at ${width}`).not.toBeNull();
    if (box && pane) {
      expect(box.x, `tab ${i} left at ${width}`).toBeGreaterThanOrEqual(pane.x);
      expect(box.x + box.width, `tab ${i} right at ${width}`).toBeLessThanOrEqual(
        pane.x + pane.width,
      );
    }
  }
}

test('seller desktop: list and panel, kitchen, empty state; tablet and phone layouts', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one run, on the desktop project');
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL;
  const stamp = `Layout-${Date.now()}`;
  for (const letter of ['A', 'B', 'C']) {
    const created = await request.post('/api/s/onde-onde/orders', {
      data: {
        firstName: `${stamp}${letter}`,
        language: 'en',
        lines: [{ itemId: 'nasi-campur', qty: 1 }],
        fulfilment: 'pickup',
      },
    });
    expect(created.ok()).toBe(true);
  }

  const wide = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  try {
    const page = await wide.newPage();
    const errors = watchConsole(page);
    await page.goto('/seller');
    await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();

    // Left panel: current page marked, the one language switch in its footer.
    const rail = page.getByRole('navigation', { name: 'Seller' });
    await expect(rail.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(rail.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Language' })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);

    // The list: a heading, search, the Changed / Not paid toggles and the status tabs.
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await expect(searchBox(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Changed \d+$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Not paid \d+$/ })).toBeVisible();
    await expectTabsInsideList(page, 1280);
    await page.screenshot({ path: 'captures/desktop-a1-table.png' });

    // The three new orders, in list order.
    await searchFor(page, stamp);
    const rows = page.getByRole('button', { name: new RegExp(stamp) });
    await expect(rows).toHaveCount(3);
    const codeOf = async (index: number) =>
      ((await rows.nth(index).textContent()) ?? '').match(/[A-Z0-9]{3}-[A-Z0-9]{3}/)?.[0] ?? '';
    const first = await codeOf(0);
    const second = await codeOf(1);
    expect(first).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);

    // The panel sits beside the list. A click opens it; the URL names the order.
    const panel = page.getByRole('complementary', { name: /^Order / });
    await rows.nth(0).click();
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/seller/orders/${first.replace('-', '')}\\?`));
    await expect(panel.getByRole('heading', { name: new RegExp(first) })).toBeVisible();
    await expect(rows.nth(1)).toBeVisible();
    await page.screenshot({ path: 'captures/desktop-a1-panel.png' });

    // Another row swaps the panel to that order; Close leaves the list with the search.
    await rows.nth(1).click();
    await expect(panel.getByRole('heading', { name: new RegExp(second) })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/seller/orders/${second.replace('-', '')}\\?`));
    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/\/seller\?/);

    // 1024 px is still the tablet layout and nothing spills sideways.
    await page.setViewportSize({ width: 1024, height: 800 });
    await expectTabsInsideList(page, 1024);
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(1024);
    await rows.nth(0).click();
    await expect(panel).toBeVisible();
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(1024);
    await panel.getByRole('button', { name: 'Close' }).click();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Kitchen: the cook list with its tools.
    await rail.getByRole('link', { name: 'Kitchen' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`Kitchen · ${sampleDay()}`);
    await expect(page.getByRole('button', { name: 'Print labels' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Group by' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pack by order' })).toBeVisible();
    await page.screenshot({ path: 'captures/desktop-a1-cook.png' });

    // The empty state. The store is shared, so the list answer is emptied in this tab only.
    await page.route('**/api/seller/orders', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      return route.fulfill({ response, json: { orders: [] } });
    });
    await rail.getByRole('link', { name: 'Orders' }).click();
    await expect(page.getByText('No orders yet')).toBeVisible();
    await page.screenshot({ path: 'captures/desktop-a1-empty.png' });
    expect(errors).toEqual([]);
  } finally {
    await wide.close();
  }

  // 600 px and up is the tablet layout: the left panel and the list, no phone bar.
  const mid = await browser.newContext({ baseURL, viewport: { width: 900, height: 800 } });
  try {
    const page = await mid.newPage();
    await page.goto('/seller');
    const rail = page.getByRole('navigation', { name: 'Seller' });
    await expect(rail.getByRole('link', { name: 'Kitchen' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'More' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Seller (phone)' })).toHaveCount(0);
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(900);
  } finally {
    await mid.close();
  }

  // The phone layout: tab bar at the bottom (Orders, Pickup & delivery, More), a list of cards.
  const narrow = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await narrow.newPage();
    const errors = watchConsole(page);
    await page.goto('/seller');
    const tabs = page.getByRole('navigation', { name: 'Seller (phone)' });
    await expect(tabs.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(tabs.getByRole('link', { name: 'Pickup & delivery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search orders' })).toBeVisible();
    const box = await tabs.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(300);
      expect(box.y + box.height).toBeGreaterThan(844 - 4);
    }
    await tabs.getByRole('link', { name: 'More' }).click();
    await expect(page).toHaveURL(/\/seller\/more$/);
    await expect(page.getByRole('radio', { name: 'ID', exact: true })).toBeVisible();
    await page.screenshot({ path: 'captures/b2flow-8-phone-more.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await narrow.close();
  }
});
