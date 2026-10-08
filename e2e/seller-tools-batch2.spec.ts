import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// The mock store is shared by parallel tests: this spec never resets it and never asserts global
// counts. It finds its own orders by unique names and notes. The settings test, which closes
// ordering for a moment, lives in seller-settings-batch2.spec.ts and runs alone.

function watchConsole(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function placeOrder(
  request: APIRequestContext,
  firstName: string,
  itemId: string,
  note?: string,
) {
  const created = await request.post('/api/orders', {
    data: {
      firstName,
      language: 'en',
      lines: [{ itemId, qty: 1 }],
      fulfilment: 'pickup',
      ...(note ? { note } : {}),
    },
  });
  expect(created.ok()).toBe(true);
}

test('cook list groups by item and by chef, and lists the notes', async ({
  page,
  request,
}, testInfo) => {
  const errors = watchConsole(page);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const note = `No chilli ${stamp}`;
  await placeOrder(request, `Rina-${stamp}`, 'tempe-mendoan', note);
  await placeOrder(request, `Tom-${stamp}`, 'nasi-campur');

  await page.goto('/seller/cook');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /(To cook|Cook list) · Sat 10 Oct/,
  );

  // Group by Item is the default: the tempeh is a row in the one list.
  await expect(page.getByRole('radio', { name: 'Item', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByText('Tempe mendoan').first()).toBeVisible();

  await page.getByRole('radio', { name: 'Chef', exact: true }).click();
  const wati = page.getByRole('region', { name: 'Chef Wati' });
  await expect(wati.getByText('Tempe mendoan')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Delave' })).toBeVisible();

  const notes = page.getByRole('region', { name: /^Notes \(/ });
  await expect(notes.getByText(`“${note}”`)).toBeVisible();
  await expect(notes).toContainText(`Rina-${stamp}`);

  await page.screenshot({
    path: `captures/seller-tools-cook-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('share builds the Both post with the order link and no chef name', async ({
  page,
}, testInfo) => {
  const errors = watchConsole(page);
  await page.goto('/seller/share');
  await page.getByRole('radio', { name: 'Both', exact: true }).click();

  const preview = page.getByLabel('Text preview');
  const origin = new URL(page.url()).origin;
  await expect(preview).toContainText(`Pesan di sini: ${origin}/`);
  await expect(preview).toContainText(`Order here: ${origin}/`);
  await expect(preview).toContainText('Tempe mendoan');
  await expect(preview).not.toContainText('Wati');
  await expect(page.getByRole('button', { name: 'Share to WhatsApp' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy text' })).toBeVisible();

  await page.screenshot({
    path: `captures/seller-tools-share-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
