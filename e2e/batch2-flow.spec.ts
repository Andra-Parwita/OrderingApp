import { expect, test, type Page } from '@playwright/test';
import { orderRow, pageScrollWidth, searchBox } from './sellerHelpers';

function watchConsole(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// Stage 4.4: the nudge and lock flow across two devices, on the real routes. The mock store is
// shared by parallel tests: this test never resets it; it finds its own order by a unique name.
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
    await searchBox(sellerPage).fill(firstName);
    const row = orderRow(sellerPage, new RegExp(firstName));
    await expect(row).toContainText('New customer');
    await row.click();
    await expect(sellerPage).toHaveURL(/\/seller\/orders\/[A-Z0-9]+\?q=/);
    await expect(sellerPage.getByText(/Wait for their WhatsApp message/)).toBeVisible();
    await sellerPage.screenshot({ path: 'captures/b2flow-2-seller-detail.png', fullPage: true });

    // Nudge: the reminder reaches the customer's order page (it polls every 15 s).
    await sellerPage.getByRole('button', { name: 'Nudge customer' }).click();
    await expect(sellerPage.getByText('Reminder sent to the customer')).toBeVisible();
    await expect(page.getByTestId('updates')).toContainText(
      'The seller is waiting for your order number on WhatsApp.',
      { timeout: 40_000 },
    );
    await page.screenshot({ path: 'captures/b2flow-3-customer-nudged.png', fullPage: true });

    // Lock: the customer can no longer change the order.
    await sellerPage.getByRole('button', { name: 'Lock order' }).click();
    await expect(sellerPage.getByRole('button', { name: 'Unlock order' })).toBeVisible();
    await expect(
      page.getByText('The seller has locked this order. Message them on WhatsApp to change it.'),
    ).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('button', { name: 'Change order' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    await page.screenshot({ path: 'captures/b2flow-4-customer-locked.png', fullPage: true });

    // Seller adds a WhatsApp order for someone else (the order panel dims the page: close it).
    await sellerPage.getByRole('button', { name: 'Close' }).click();
    await sellerPage.getByRole('button', { name: '+ New order' }).click();
    await expect(sellerPage).toHaveURL(/\/seller\/new$/);
    const walkIn = `Lisa-${Date.now()}`;
    await sellerPage.getByLabel('Customer first name').fill(walkIn);
    await sellerPage.getByRole('button', { name: 'One more Tilapia pesmol' }).click();
    await sellerPage.getByRole('button', { name: 'Create order' }).click();
    await expect(sellerPage.getByText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)).toBeVisible();
    await sellerPage.screenshot({ path: 'captures/b2flow-5-seller-saved.png', fullPage: true });

    expect(sellerErrors).toEqual([]);
  } finally {
    await seller.close();
  }
  expect(customerErrors).toEqual([]);
});

// Every status filter chip must sit fully inside the list pane (the pane that holds the search).
async function expectChipsInsideList(page: Page, width: number) {
  const group = page.getByRole('group', { name: 'Filter by status' });
  const chips = group.getByRole('button');
  await expect(chips).toHaveCount(7);
  const pane = await page.getByRole('main').boundingBox();
  expect(pane, `list pane at ${width}`).not.toBeNull();
  for (let i = 0; i < 7; i += 1) {
    const chip = chips.nth(i);
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box, `chip ${i} at ${width}`).not.toBeNull();
    if (box && pane) {
      expect(box.x, `chip ${i} left at ${width}`).toBeGreaterThanOrEqual(pane.x);
      expect(box.x + box.width, `chip ${i} right at ${width}`).toBeLessThanOrEqual(
        pane.x + pane.width,
      );
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
}

test('seller desktop: table, slide-over, cook list, empty state; phone unchanged', async ({
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

    // Rail: current page marked, the one language switch in its footer.
    const rail = page.getByRole('navigation', { name: 'Seller' });
    await expect(rail.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(rail.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Language' })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);

    // A1-1: the table, six columns, rows open with a click.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Orders · /);
    const table = page.getByRole('table', { name: 'Orders' });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Order',
      'Name',
      'What they ordered',
      'Total',
      'Status',
      'Needs attention',
    ]);
    await expect(page.getByRole('button', { name: /^Edited by customer \d+$/ })).toBeVisible();
    await expectChipsInsideList(page, 1280);
    await page.screenshot({ path: 'captures/desktop-a1-table.png' });

    // The three new orders, in table order.
    await searchBox(page).fill(stamp);
    const rows = table.getByRole('row').filter({ hasText: stamp });
    await expect(rows).toHaveCount(3);
    const codeOf = async (index: number) =>
      (await rows.nth(index).getByRole('cell').first().textContent()) ?? '';
    const first = await codeOf(0);
    const second = await codeOf(1);
    expect(first).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);

    // A1-2: the panel. Click opens it; the URL names the order, so Back would close it.
    await rows.nth(0).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page).toHaveURL(new RegExp(`/seller/orders/${first.replace('-', '')}\\?`));
    await expect(dialog.getByRole('heading', { name: first })).toBeVisible();
    await expect(dialog).toBeFocused();
    await page.screenshot({ path: 'captures/desktop-a1-panel.png' });

    // Next order moves to the next row of the same table.
    await dialog.getByRole('button', { name: /Next order/ }).click();
    await expect(dialog.getByRole('heading', { name: second })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/seller/orders/${second.replace('-', '')}\\?`));

    // Escape closes it and focus is back on that row; Enter opens it again.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/seller\?/);
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('heading', { name: second })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);

    // 1024 px is still the desktop layout and nothing spills sideways.
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(table).toBeVisible();
    await expectChipsInsideList(page, 1024);
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(1024);
    await rows.nth(0).click();
    await expect(dialog).toBeVisible();
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(1024);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 800 });

    // A1-3: the cook list, with who ordered inline.
    await rail.getByRole('link', { name: 'Cook list' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cook list · Sat 10 Oct');
    await expect(page.getByRole('button', { name: 'Print cook list' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Group by' })).toBeVisible();
    const chipA = page
      .getByRole('list', { name: 'Who ordered' })
      .getByRole('listitem')
      .filter({ hasText: `${stamp}A` });
    await expect(chipA).toContainText('\u00d71');
    await expect(page.getByRole('button', { name: /Who ordered/ })).toHaveCount(0);
    await page.screenshot({ path: 'captures/desktop-a1-cook.png' });

    // A1-4: the empty state. The store is shared, so the list answer is emptied in this tab only.
    await page.route('**/api/seller/orders', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      return route.fulfill({ response, json: { orders: [] } });
    });
    await rail.getByRole('link', { name: 'Orders' }).click();
    await expect(page.getByText('No orders yet')).toBeVisible();
    await expect(page.getByText("Share this week's menu to start taking orders.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share menu on WhatsApp' })).toBeVisible();
    await page.screenshot({ path: 'captures/desktop-a1-empty.png' });
    await page.getByRole('button', { name: 'Share menu on WhatsApp' }).click();
    await expect(page).toHaveURL(/\/seller\/share$/);
    expect(errors).toEqual([]);
  } finally {
    await wide.close();
  }

  // 820 to 1023 px uses the phone layout, as it did before.
  const mid = await browser.newContext({ baseURL, viewport: { width: 900, height: 800 } });
  try {
    const page = await mid.newPage();
    await page.goto('/seller');
    await expect(
      page.getByRole('navigation', { name: 'Seller' }).getByRole('link', { name: 'More' }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  } finally {
    await mid.close();
  }

  // The phone layout is unchanged: tab bar at the bottom, cards, no table.
  const narrow = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await narrow.newPage();
    const errors = watchConsole(page);
    await page.goto('/seller');
    const tabs = page.getByRole('navigation', { name: 'Seller' });
    await expect(tabs.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByLabel('Order code or name')).toBeVisible();
    const box = await tabs.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(300);
      expect(box.y + box.height).toBeGreaterThan(844 - 4);
    }
    await tabs.getByRole('link', { name: 'More' }).click();
    await expect(page).toHaveURL(/\/seller\/more$/);
    await page.getByRole('button', { name: /^Settings/ }).click();
    await expect(page).toHaveURL(/\/seller\/settings$/);
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeVisible();
    await page.screenshot({ path: 'captures/b2flow-8-phone-settings.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await narrow.close();
  }
});
