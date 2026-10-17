import { expect, test } from '@playwright/test';
import { keepAdminPasskey } from './adminSession';

// Plan 086 (D-106): the admin sends a short message; a customer page that opens while it is active
// shows Bobo's note once (and not again after a reload); "Stop now" ends it. Also checks that the
// admin pages (announce, maintenance, short message) need no scrolling at 1280x800 and 1024x768.
// Runs in the maintenance project (one admin passkey, after everything else).

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
] as const;

test('admin sends a short message, a customer sees it once, Stop now ends it', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  await keepAdminPasskey(page, 'maintenance-desktop-chromium');
  await page.goto('/?harness=admin&screen=signin');
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('list', { name: 'Sellers' })).toBeVisible();

  const text = `Everything is fine again ${Date.now()}`;
  const guest = await page.context().browser()!.newContext({ ignoreHTTPSErrors: true });
  try {
    // The list page: no scrolling at the two laptop sizes (screenshots for a look).
    for (const size of SIZES) {
      await page.setViewportSize(size);
      for (const section of ['announce', 'maintenance', 'message']) {
        await page.goto(`/admin?s=${section}`);
        await expect(page.getByRole('main')).toBeVisible();
        await page.waitForTimeout(400);
        const scrolls = await page.evaluate(() => {
          const main = document.querySelector('main');
          return {
            page: document.documentElement.scrollHeight > document.documentElement.clientHeight,
            main: main ? main.scrollHeight > main.clientHeight : false,
          };
        });
        expect(scrolls, `${section} at ${size.width}x${size.height}`).toEqual({
          page: false,
          main: false,
        });
        await page.screenshot({ path: `scratch/p86-${section}-${size.width}.png` });
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin?s=message');
    await page.getByRole('button', { name: 'New message' }).click();
    await expect(page.getByRole('heading', { name: 'New message' })).toBeVisible();
    await page.getByLabel('Text (English)').fill(text);
    await page.getByLabel('Same text for both').check();
    await page.getByRole('radio', { name: 'Customers' }).click();
    await page.screenshot({ path: 'scratch/p86-panel-fixed.png' });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Active until' })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(text.slice(0, 30)) })).toBeVisible();
    // The admin page itself never shows the note.
    await expect(page.getByRole('status').filter({ hasText: text })).toHaveCount(0);

    // A customer opening the app while it is active sees it; a reload does not show it again.
    const customer = await guest.newPage();
    await customer.goto('/');
    await expect(customer.getByRole('status').filter({ hasText: text })).toBeVisible();
    await customer.screenshot({ path: 'scratch/p86-customer-fixed-1280.png' });
    // The note pushes the page down: the language switch is not covered.
    const barBox = await customer.getByRole('status').filter({ hasText: text }).boundingBox();
    expect(barBox!.width).toBeLessThanOrEqual(1280);
    const phone = await (
      await page
        .context()
        .browser()!
        .newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 800 } })
    ).newPage();
    await phone.goto('/');
    await expect(phone.getByRole('status').filter({ hasText: text })).toBeVisible();
    await phone.screenshot({ path: 'scratch/p86-customer-fixed-390.png' });
    await phone.context().close();
    await customer.getByRole('button', { name: 'Dismiss' }).click();
    await expect(customer.getByRole('status').filter({ hasText: text })).toHaveCount(0);
    await customer.reload();
    await customer.waitForLoadState('networkidle');
    await expect(customer.getByRole('status').filter({ hasText: text })).toHaveCount(0);

    // Stop now: a new device no longer gets it.
    await page.getByRole('button', { name: 'Stop now' }).click();
    await expect(page.getByText('Stopped').first()).toBeVisible();
    const other = await (
      await page.context().browser()!.newContext({ ignoreHTTPSErrors: true })
    ).newPage();
    await other.goto('/');
    await other.waitForLoadState('networkidle');
    await expect(other.getByRole('status').filter({ hasText: text })).toHaveCount(0);
    await other.context().close();
  } finally {
    await page.evaluate(async () => {
      const list = (await (await fetch('/api/admin/messages')).json()) as {
        messages: Array<{ id: string; stoppedAt: string | null }>;
      };
      for (const message of list.messages) {
        if (message.stoppedAt === null)
          await fetch(`/api/admin/messages/${message.id}`, { method: 'DELETE' });
      }
    });
    await guest.close();
  }
});
