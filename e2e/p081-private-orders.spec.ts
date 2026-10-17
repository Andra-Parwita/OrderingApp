import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { collectErrors } from './sellerHelpers';

// Plan 081 (D-104): the owner makes a private (Khusus) delivery order for today with a library dish and
// a deposit. It shows in the Private list with Directions, in Cook with the Private tag, its status
// moves, the customer's link shows "Still to pay" and no edit button, and cancelling moves it to Past.
// Works on the second sample seller (Dapur Demo). The order is made through the API (the editor has
// its own unit tests); a private order cannot be deleted, so it is cancelled at the end, which takes it
// out of Cook. Like dish-pictures it changes the shared kitchen, so it runs in the settings projects.

const SELLER = 'dapur-demo';
const HEADERS = { 'X-Seller': SELLER };

test.skip(({ viewport }) => (viewport?.width ?? 0) < 600, 'tablet and desktop only');

test('a private order: list, Cook, status, the customer page and cancel', async ({
  browser,
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  const name = `Rina ${Date.now().toString(36)}`;

  // Today in the kitchen's zone, and a dish from the library.
  const due = (await (
    await request.get('/api/seller/private?due=1', { headers: HEADERS })
  ).json()) as {
    today: string;
  };
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
      depositCents: 500,
      lines: [{ dishId: dish.id, qty: 3 }],
    },
  });
  expect(made.status()).toBe(201);
  const order = ((await made.json()) as { order: { code: string; token: string } }).order;
  let cancelled = false;
  try {
    await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);

    // The Private list: the order, with Directions on its day.
    await page.goto('/seller/private');
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole('link', { name: `Directions to ${name}` })).toBeVisible();

    // Pickup & delivery on a phone: the private delivery is in the Delivery tab with Directions.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/seller/hand-over');
    await page.getByRole('radio', { name: /^Delivery/ }).click();
    const handRow = page.getByRole('listitem', { name: new RegExp(`, ${name}$`) });
    await expect(handRow).toBeVisible();
    await expect(handRow.getByText('Private', { exact: true })).toBeVisible();
    await expect(handRow.getByRole('link', { name: `Directions to ${name}` })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Cook: counted with the Private tag.
    await page.goto('/seller/cook');
    await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(dish.name.en).first()).toBeVisible();

    // A status move on the order's page.
    await page.goto(`/seller/private/${order.code}`);
    await page.getByRole('button', { name: 'Mark as Out for delivery' }).click();
    await expect(page.getByText('Out for delivery').first()).toBeVisible();

    // The customer's link: what is still to pay, nothing to change.
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      await markHowItWorksSeen(context);
      const customer = await context.newPage();
      await customer.goto(`/o/${order.token}`);
      await expect(customer.getByText('Private order')).toBeVisible();
      await expect(customer.getByText('Still to pay')).toBeVisible();
      await expect(customer.getByRole('button', { name: 'Change order' })).toHaveCount(0);
      await expect(customer.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    } finally {
      await context.close();
    }

    // Cancel: the owner asks first, then it moves to Past as Cancelled.
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('button', { name: 'Yes, cancel' }).click();
    cancelled = true;
    await page.goto('/seller/private');
    await page.getByRole('radio', { name: 'Past' }).click();
    const row = page.getByRole('button', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Cancelled');
    expect(errors).toEqual([]);
  } finally {
    // Never leave it live for the other specs.
    if (!cancelled) {
      await request.post(`/api/seller/private/${order.code}/cancel`, { headers: HEADERS });
    }
  }
});
