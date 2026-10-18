import { expect, test } from '@playwright/test';
import { goToName, markHowItWorksSeen, openDishes } from './customerHelpers';

// Plan 089 #5: 5 orders per 10 minutes per kitchen per client, and the customer sees why the 6th is
// refused. The local server has the limit off unless a request sends `X-Dev-Order-Limit: on`
// (DEV_TOOLS only), so this context sends it. Runs in the serial "limits" project: it adds orders
// to Onde Onde (cancelled again at the end) and uses an unlimited dish.
const TEXT = {
  en: 'Too many orders in a short time. Please wait a few minutes or message the kitchen.',
  id: 'Terlalu banyak pesanan dalam waktu singkat. Tunggu beberapa menit atau kabari dapurnya.',
};

test('the 6th order in ten minutes is refused with a message the customer can read', async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'X-Dev-Order-Limit': 'on' },
  });
  await markHowItWorksSeen(context);
  const page = await context.newPage();
  const tokens: Array<string> = [];
  try {
    const menu = await context.request.get('/api/s/onde-onde/menu');
    const items = ((await menu.json()) as { items: Array<{ id: string; limit?: number }> }).items;
    const free = items.find((item) => item.limit === undefined);
    if (!free) throw new Error('no unlimited dish');
    const place = (name: string) =>
      context.request.post('/api/s/onde-onde/orders', {
        data: {
          firstName: `${name}-${testInfo.project.name}-${Date.now()}`,
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: free.id, qty: 1 }],
        },
      });
    // Five go through (the API is the same call the basket makes).
    for (let n = 1; n <= 5; n += 1) {
      const response = await place(`Cap${n}`);
      expect(response.status(), await response.text()).toBe(201);
      tokens.push(((await response.json()) as { token: string }).token);
    }

    // The sixth goes through the real screens.
    await openDishes(page, 'onde-onde');
    await page
      .getByRole('button', { name: /^Add one / })
      .first()
      .click();
    await goToName(page);
    await page.getByLabel('First name').fill(`Cap6-${testInfo.project.name}`);
    await page.getByRole('button', { name: /^Place order/ }).click();
    await expect(page.getByText(TEXT.en)).toBeVisible();
    await expect(page).toHaveURL(/\/onde-onde\/basket\/name$/);

    // The same message in Indonesian.
    await page.goto('/settings');
    await page.getByRole('button', { name: /^Language/ }).click();
    await page.getByRole('radio', { name: 'Bahasa Indonesia' }).click();
    await page.goto('/onde-onde/basket/name');
    await page.getByRole('button', { name: /^Pesan ·/ }).click();
    await expect(page.getByText(TEXT.id)).toBeVisible();
  } finally {
    for (const token of tokens) await context.request.post(`/api/orders/${token}/cancel`);
    await context.close();
  }
});
