import { expect, test, type Page } from '@playwright/test';

// Labels print where the page starts (the Pack "Print label" bug: the off-screen print job printed a
// blank page, and a tablet driver cropped the Labels sheet). Print media is emulated and window.print
// is stubbed; the print job stays mounted until `afterprint`. A private order for today (a dish from
// the library) gives both screens a label, and is cancelled at the end, so it runs with the isolated
// specs (it changes what Cook counts).

const SELLER = 'dapur-demo';
const HEADERS = { 'X-Seller': SELLER };
const SIZES = [
  { width: 234, height: 151 },
  { width: 794, height: 1123 },
];

test.skip(({ viewport }) => (viewport?.width ?? 0) < 600, 'desktop only');

async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript((slug) => {
    localStorage.setItem('devSeller', slug);
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed += 1;
    };
  }, SELLER);
}

async function expectAtOrigin(page: Page, selector: string, name: string, dish: string) {
  const area = page.locator(selector);
  await expect(area).toHaveCount(1);
  const box = await area.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    // Page coordinates: print ignores how far the screen was scrolled.
    return { left: rect.left + scrollX, top: rect.top + scrollY, text: node.textContent ?? '' };
  });
  expect(box.left, 'print area left').toBeGreaterThanOrEqual(0);
  expect(box.top, 'print area top').toBeGreaterThanOrEqual(0);
  expect(box.text).toContain(name);
  expect(box.text).toContain(dish);
}

test('printing: Pack opens the Labels preview; Labels and Print orders sit at the page corner', async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const name = `Lia${Date.now().toString(36)}`;
  const due = (await (
    await request.get('/api/seller/private?due=1', { headers: HEADERS })
  ).json()) as { today: string };
  const dishes = (await (await request.get('/api/seller/dishes', { headers: HEADERS })).json()) as {
    dishes: Array<{ id: string; name: { en: string } }>;
  };
  const dish = dishes.dishes[0];
  expect(dish).toBeDefined();
  if (!dish) return;
  const made = await request.post('/api/seller/private', {
    headers: HEADERS,
    data: {
      firstName: name,
      language: 'en',
      eventDate: due.today,
      eventTime: '12:00',
      fulfilment: 'delivery',
      address: { street: '12 Test Lane', suburb: 'Norwood', postcode: '5067' },
      depositCents: 0,
      lines: [{ dishId: dish.id, qty: 2 }],
    },
  });
  expect(made.status()).toBe(201);
  const order = ((await made.json()) as { order: { code: string } }).order;
  // Print orders lists the menu's orders (a private one is not on it), so a customer order too.
  const menu = (await (await request.get(`/api/s/${SELLER}/menu`)).json()) as {
    items?: Array<{ id: string }>;
  };
  const pickName = `Pri${Date.now().toString(36)}`;
  // Other specs may have sold some items out: take the first item that still accepts an order.
  let placed = null;
  for (const item of menu.items ?? []) {
    const attempt = await request.post(`/api/s/${SELLER}/orders`, {
      data: {
        firstName: pickName,
        language: 'en',
        lines: [{ itemId: item.id, qty: 1 }],
        fulfilment: 'pickup',
      },
    });
    if (attempt.ok()) {
      placed = attempt;
      break;
    }
  }
  expect(placed, 'an item that is not sold out').not.toBeNull();
  if (!placed) return;
  const customer = ((await placed.json()) as { order: { token: string } }).order;
  try {
    await stubPrint(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/seller/cook?tab=pack');
    await page
      .getByRole('button', { name: new RegExp(name) })
      .first()
      .click();
    // Pack opens the Labels preview with just this order (plan 084); Print is there.
    await page.getByRole('button', { name: 'Print label', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/seller/labels[?]order=${order.code}`));
    await expect(page.getByTestId('label-sheets')).toContainText(name);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByText(/scale to 100%/)).toBeVisible();
    await expect(page.getByRole('radio', { name: /62 mm roll/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Print', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as never as { __printed: number }).__printed))
      .toBe(1);
    await page.emulateMedia({ media: 'print' });
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await expectAtOrigin(page, '[data-testid="label-sheets"]', name, dish.name.en);
    }
    await page.emulateMedia({ media: null });

    // The Labels screen, also on a tablet (touch, 800 x 1280).
    const sizes = [...SIZES, { width: 800, height: 1280 }];
    const tablet = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: 800, height: 1280 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const labels = await tablet.newPage();
      await stubPrint(labels);
      await labels.goto('/seller/labels');
      await expect(labels.getByTestId('label-sheets')).toContainText(name);
      await labels.emulateMedia({ media: 'print' });
      for (const size of sizes) {
        await labels.setViewportSize(size);
        await expectAtOrigin(labels, '[data-testid="label-sheets"]', name, dish.name.en);
      }

      // Print orders (A4 list) sits at the page corner too, on A4 and on the tablet.
      await labels.emulateMedia({ media: null });
      await labels.setViewportSize({ width: 800, height: 1280 });
      await labels.goto('/seller/orders/print');
      await expect(labels.getByTestId('print-pages')).toContainText(pickName);
      await expect(labels.getByText(/scale to 100%/)).toBeVisible();
      await labels.emulateMedia({ media: 'print' });
      for (const size of sizes) {
        await labels.setViewportSize(size);
        await expectAtOrigin(labels, '[data-testid="print-pages"]', pickName, 'Totals');
        if (size.width === 794) {
          await labels.screenshot({ path: 'scratch/labtest/p84-printorders-a4.png' });
        }
        const wide = await labels
          .getByTestId('print-pages')
          .evaluate((node) => node.getBoundingClientRect().right <= innerWidth + 1);
        expect(wide, 'print pages fit the width').toBe(true);
      }
    } finally {
      await tablet.close();
    }
  } finally {
    await request.post(`/api/seller/private/${order.code}/cancel`, { headers: HEADERS });
    await request.post(`/api/orders/${customer.token}/cancel`);
  }
});
