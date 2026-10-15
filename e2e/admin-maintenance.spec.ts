import { expect, test } from '@playwright/test';
import { keepAdminPasskey } from './adminSession';

// Maintenance is app-wide (a bar and the Updating screen on every page), so this spec runs alone in
// its own project, after everything else (playwright.config.ts, MAINTENANCE).

// Plan 046: announce an update (a quiet bar everywhere), switch maintenance on (customers see the
// Updating screen), switch it off (the screen goes by itself). Cleans up after itself in `finally`.
test('admin announces an update, switches maintenance on, and the Updating screen clears when off', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop only');
  await keepAdminPasskey(page, 'maintenance-desktop-chromium');
  await page.goto('/?harness=admin&screen=signin');
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('list', { name: 'Sellers' })).toBeVisible();
  await page.goto('/admin?s=announce');
  await page.setViewportSize({ width: 1180, height: 820 });

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const second = await page.context().newPage();
  try {
    await page.getByLabel('Date').fill(tomorrow);
    await page.getByLabel('Start').fill('22:00');
    await page.getByLabel('Minutes').fill('15');
    await page.getByLabel(/Note \(English/).fill('Short database upgrade.');
    await page.getByRole('button', { name: 'Announce', exact: true }).click();
    await expect(page.getByText(/Announced: /)).toBeVisible();

    // Reload so the bar reads the new announcement; it sits above the page.
    await page.reload();
    const bar = page.getByRole('status').filter({ hasText: 'Maintenance on' });
    await expect(bar).toContainText('The app pauses briefly. Short database upgrade.');
    await page.screenshot({ path: 'captures/p046/notice-bar.png' });

    await page.getByRole('button', { name: 'Turn maintenance on' }).click();
    await page.getByRole('button', { name: 'Tap again to turn on' }).click();
    await expect(page.getByText(/Maintenance is ON/)).toBeVisible();

    // A customer's phone: the full screen, no errors. The clock is faked so the 30 s poll runs at once.
    await second.setViewportSize({ width: 390, height: 844 });
    await second.clock.install();
    await second.goto('/');
    await expect(
      second.getByRole('alert').filter({ hasText: 'Updating, back in a few minutes' }),
    ).toBeVisible();
    await second.screenshot({ path: 'captures/p046/updating-screen.png' });

    // Writes are refused while it is on (a same-site call from the page, with its session).
    const refused = await page.evaluate(
      async () => (await fetch('/api/s/onde-onde/orders', { method: 'POST', body: '{}' })).status,
    );
    expect(refused).toBe(503);

    await page.getByRole('button', { name: 'Turn maintenance off' }).click();
    await expect(page.getByText(/Maintenance is off/)).toBeVisible();
    await second.clock.runFor(31_000);
    await expect(second.getByRole('alert')).toHaveCount(0);
  } finally {
    await page.evaluate(() =>
      fetch('/api/admin/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance: false, notice: null }),
      }),
    );
    await second.close();
  }
});
