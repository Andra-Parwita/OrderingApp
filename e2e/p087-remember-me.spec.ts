import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
} from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';
import { orderRow, searchFor } from './sellerHelpers';

// Plan 087 stage 4: Remember me with Chrome's virtual authenticator (with and without the PRF
// extension), a restore on a "new phone" (credential copied over), the 6-digit join, and delete.
// Customer data is per passkey account and orders use unique names, so this runs with the main phone project.
test.use({ viewport: { width: 390, height: 844 } });

const ORIGIN = 'https://localhost:5181';
const STREET = '12 Jetty Road';
const ADDRESS_LINE = `${STREET}, Glenelg 5045`;

type Phone = { context: BrowserContext; page: Page; cdp: CDPSession; id: string };

async function newPhone(browser: Browser, hasPrf: boolean): Promise<Phone> {
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 390, height: 844 },
    timezoneId: 'Australia/Adelaide',
    extraHTTPHeaders: { Origin: ORIGIN },
  });
  await markHowItWorksSeen(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
      hasPrf,
    } as never,
  });
  return { context, page, cdp, id: authenticatorId };
}

async function turnOnFromChip(page: Page): Promise<void> {
  await page.goto('/onde-onde');
  await page.getByRole('button', { name: 'Remember me on all my phones' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText("What's a passkey?")).toBeVisible();
  await sheet.getByRole('button', { name: 'Turn on', exact: true }).click();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /Remember me/ })).toContainText('On');
}

async function placeDelivery(page: Page, firstName: string): Promise<void> {
  await page.goto('/onde-onde/dishes');
  await page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByRole('radio', { name: 'Delivery' }).click();
  await page.getByLabel('Street number and name').fill(STREET);
  await page.getByLabel('Suburb').fill('Glenelg');
  await page.getByLabel('Postcode').fill('5045');
  await page.getByRole('button', { name: /Next: your name/ }).click();
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
}

const savedAddress = async (phone: Phone) => {
  const response = await phone.context.request.get('/api/customer/address');
  return (await response.json()) as { sealed: unknown };
};

test('Remember me end to end', async ({ browser, page: seller }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
  test.setTimeout(150_000);
  const firstName = `Rem-${Date.now()}`.slice(0, 30);
  const a = await newPhone(browser, true);
  const opened: Array<Phone> = [a];
  try {
    // a. Phone A: chip -> explanation -> Turn on -> code; a delivery order is marked for the seller.
    await turnOnFromChip(a.page);
    const code = (await a.page.locator('output').first().textContent())?.trim() ?? '';
    expect(code).toMatch(/^C-[A-Z0-9]{4}$/);
    await placeDelivery(a.page, firstName);
    await expect
      .poll(async () => (await savedAddress(a)).sealed, { timeout: 15_000 })
      .not.toBeNull();

    await seller.goto('/seller/orders');
    await searchFor(seller, firstName);
    await orderRow(seller, new RegExp(firstName)).click();
    await expect(seller.getByText(new RegExp(`✓ .*${code}`)).first()).toBeVisible();

    // b. Phone A with its site data cleared (a new phone with the synced passkey). Chrome's virtual authenticator cannot copy a passkey's PRF secret, so the address is proved
    // on a phone whose site data was cleared (the synced passkey stays, as in a real new phone).
    await a.context.clearCookies();
    await a.page.goto('/api/customer/me'); // same origin, no app code holding the database open
    await a.page.evaluate(async () => {
      localStorage.clear();
      for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name);
    });
    await a.page.goto('/my-orders');
    await a.page.getByRole('button', { name: 'Restore them' }).click();
    await expect(a.page.getByText(/1 order restored/)).toBeVisible();
    await a.page.goto('/onde-onde/dishes');
    await a.page.getByRole('button', { name: 'Add one Tilapia pesmol' }).click();
    await a.page.getByRole('button', { name: /View basket/ }).click();
    await a.page.getByRole('radio', { name: 'Delivery' }).click();
    await expect(a.page.getByText(ADDRESS_LINE)).toBeVisible();
    await a.page.getByRole('button', { name: /Next: your name/ }).click();
    await expect(a.page.getByLabel('First name')).toHaveValue(firstName);

    // Phone B: the same passkey copied to a second authenticator restores the orders list (after A, because the virtual signCount only grows).
    const b = await newPhone(browser, true);
    opened.push(b);
    const { credentials } = await a.cdp.send('WebAuthn.getCredentials', { authenticatorId: a.id });
    expect(credentials.length).toBe(1);
    for (const credential of credentials) {
      await b.cdp.send('WebAuthn.addCredential', { authenticatorId: b.id, credential });
    }
    await b.page.goto('/my-orders');
    await b.page.getByRole('button', { name: 'Restore them' }).click();
    await expect(b.page.getByText(/1 order restored/)).toBeVisible();
    // c. Phone C without PRF: no sealed address on the server, the note shows.
    const c = await newPhone(browser, false);
    opened.push(c);
    await turnOnFromChip(c.page);
    await expect(c.page.getByText(/can't seal your address/)).toBeVisible();
    await placeDelivery(c.page, `${firstName}c`);
    expect((await savedAddress(c)).sealed).toBeNull();

    // d. Join with a 6-digit code from phone A, which also makes the new phone's own passkey.
    await a.page.goto('/settings');
    await a.page.getByRole('button', { name: 'Add another phone' }).click();
    const digits =
      (await a.page
        .getByRole('dialog')
        .getByText(/^\d{6}$/)
        .textContent()) ?? '';
    const d = await newPhone(browser, true);
    opened.push(d);
    await d.page.goto('/settings');
    await d.page.getByRole('button', { name: 'Use a 6 digit code instead' }).click();
    await d.page.getByLabel('Type the 6 digit code').fill(digits.trim());
    await d.page.getByRole('button', { name: 'Add this phone' }).click();
    await expect(d.page.getByRole('button', { name: 'Add another phone' })).toBeVisible();
    const own = await d.cdp.send('WebAuthn.getCredentials', { authenticatorId: d.id });
    expect(own.credentials.length).toBe(1); // the joined phone made its own passkey

    // e. Delete from A: signed out on the server, the seller still has the order.
    await a.page.goto('/settings');
    await a.page.getByRole('button', { name: 'Delete my saved data' }).click();
    await a.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(a.page.getByText('Your saved data is deleted.')).toBeVisible();
    expect((await a.context.request.get('/api/customer/me')).status()).toBe(401);
    await seller.goto('/seller/orders');
    await searchFor(seller, firstName);
    await expect(orderRow(seller, new RegExp(firstName))).toBeVisible();
  } finally {
    for (const phone of opened) await phone.context.close();
  }
});
