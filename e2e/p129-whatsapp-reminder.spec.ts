import { expect, test, type Page } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 129: an unconfirmed order keeps asking to be sent on WhatsApp (Order placed, the menu's first
// page, the order page, My orders) until the seller confirms it. Also the layout proof: each screen
// at iPhone 390x844, Android 412x915 and 360x780 with the text at 125%, in English and Indonesian.
// The mock store is shared: the order is found by a unique first name.
test.describe.configure({ mode: 'serial' });
// Many full-page captures: a loaded machine needs more than the default 30 s.
test.setTimeout(90_000);
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone only');
});

const SIZES = [
  { name: 'iphone', width: 390, height: 844, big: false },
  { name: 'android', width: 412, height: 915, big: false },
  { name: 'small-125', width: 360, height: 780, big: true },
] as const;

async function shoot(page: Page, lang: string, screen: string): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.addStyleTag({
      content: `html { font-size: ${size.big ? '125%' : '100%'} !important; }`,
    });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      size.width,
    );
    await page.screenshot({
      path: `scratch/cap-129/${lang}-${screen}-${size.name}.png`,
      fullPage: true,
    });
  }
  await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
  await page.setViewportSize({ width: 390, height: 844 });
}

async function place(page: Page, firstName: string): Promise<string> {
  await page.goto('/onde-onde/dishes');
  await page
    .getByRole('button', { name: /Add one|Tambah satu/ })
    .first()
    .click();
  await page.getByRole('button', { name: /View basket|Lihat keranjang/ }).click();
  await page.getByRole('radio', { name: /Pickup|Ambil/ }).click();
  await page.getByRole('button', { name: /Next: your name|Lanjut: nama/ }).click();
  await expect(page.getByText(/You can change or cancel until/)).toHaveCount(0);
  await page.getByLabel(/First name|Nama depan/).fill(firstName);
  await shoot(page, 'en', 'checkout');
  await expect(page.getByTestId('send-next')).toBeVisible();
  // The tap reserves a tab and the order's WhatsApp link goes into it once the order is saved.
  await page.evaluate(() => {
    const opened: Array<string> = [];
    const tab = {
      opener: null,
      close: () => undefined,
      location: {
        set href(value: string) {
          opened.push(value);
        },
      },
    };
    Object.assign(window, { __opened: opened });
    window.open = () => tab as unknown as Window;
  });
  await page.getByRole('button', { name: /^(Place order|Pesan)/ }).click();
  await expect(page).toHaveURL(/\/o\/[^/]+\/placed$/);
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: Array<string> }).__opened,
  );
  expect(opened).toHaveLength(1);
  expect(opened[0]).toContain('https://api.whatsapp.com/send');
  expect(decodeURIComponent(opened[0] ?? '')).toContain(`Name: ${firstName}`);
  return (await page.getByTestId('order-code').textContent())?.replace('-', '') ?? '';
}

test('place, remind everywhere, then the seller confirms and the reminders go', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  const firstName = `Wa-${Date.now()}`;
  await page.setViewportSize({ width: 390, height: 844 });

  const code = await place(page, firstName);
  await expect(page.getByRole('heading', { name: 'Almost done' })).toBeVisible();
  await expect(page.getByTestId('send-note')).toBeVisible();
  await expect(page.getByText(/is optional/)).toHaveCount(0);
  await shoot(page, 'en', 'order-placed');

  // The menu's first page: the card for this order, and the line for everyone.
  await page.goto('/onde-onde');
  const card = page.getByTestId('menu-reminder').filter({ hasText: code.slice(0, 3) });
  await expect(card).toBeVisible();
  await expect(page.getByTestId('after-ordering')).toBeVisible();
  await shoot(page, 'en', 'menu-home');

  // The order page and My orders.
  await page.goto('/my-orders');
  await expect(page.getByText('Send on WhatsApp').first()).toBeVisible();
  await shoot(page, 'en', 'my-orders');
  await page
    .getByRole('button', { name: new RegExp(code.slice(0, 3)) })
    .first()
    .click();
  await expect(page.getByTestId('wa-reminder')).toBeVisible();
  await shoot(page, 'en', 'order-page');

  // Indonesian, once.
  await context.addInitScript(() => localStorage.setItem('lang', 'id'));
  await page.evaluate(() => localStorage.setItem('lang', 'id'));
  await page.goto('/onde-onde');
  await expect(page.getByTestId('menu-reminder').first()).toContainText('belum dikonfirmasi');
  await shoot(page, 'id', 'menu-home');
  await page.goto('/my-orders');
  await shoot(page, 'id', 'my-orders');
  await page
    .getByRole('button', { name: new RegExp(code.slice(0, 3)) })
    .first()
    .click();
  await expect(page.getByTestId('wa-reminder')).toBeVisible();
  await shoot(page, 'id', 'order-page');
  await page.evaluate(() => localStorage.setItem('lang', 'en'));

  // The seller confirms (dev server: no login): every reminder goes.
  const done = await page.request.post(`/api/seller/orders/${code}/status`, {
    data: { to: 'confirmed' },
  });
  expect(done.ok()).toBe(true);
  await page.goto('/onde-onde');
  await expect(page.getByTestId('after-ordering')).toBeVisible();
  await expect(page.getByTestId('menu-reminder').filter({ hasText: code.slice(0, 3) })).toHaveCount(
    0,
  );
  await page.goto('/my-orders');
  await page
    .getByRole('button', { name: new RegExp(code.slice(0, 3)) })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /Order|Pesanan/ }).first()).toBeVisible();
  await expect(page.getByTestId('wa-reminder')).toHaveCount(0);
  await shoot(page, 'en', 'order-page-confirmed');
});

test('the last checkout step in Indonesian', async ({ page, context }) => {
  await markHowItWorksSeen(context);
  await context.addInitScript(() => localStorage.setItem('lang', 'id'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/onde-onde/dishes');
  await page
    .getByRole('button', { name: /^(Tambah (?!catatan)|Add one)/ })
    .first()
    .click();
  await page.getByRole('button', { name: /Lihat keranjang|View basket/ }).click();
  await page.getByRole('radio', { name: /Ambil|Pickup/ }).click();
  await page.getByRole('button', { name: /Berikutnya|Next/ }).click();
  await expect(page.getByTestId('send-next')).toContainText('Selanjutnya Anda mengirim');
  await shoot(page, 'id', 'checkout');
});
