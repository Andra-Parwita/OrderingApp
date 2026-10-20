import { expect, test } from '@playwright/test';
import { contentSecurityPolicy } from '../worker/securityHeaders';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 115: while the app file is slow, the page shows the kitchen's colour and name, never black.
const SCRIPT = /\.(?:m?js|tsx?)(?:\?.*)?$/;

for (const scheme of ['light', 'dark'] as const) {
  test(`splash while the app loads (${scheme})`, async ({ page, context }) => {
    await context.route(
      (url) => SCRIPT.test(url.pathname),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      },
    );
    await page.emulateMedia({ colorScheme: scheme });
    await markHowItWorksSeen(context);
    await page.goto('/onde-onde', { waitUntil: 'commit' });

    const splash = page.locator('#splash');
    await expect(splash).toBeVisible();
    await expect(page.locator('#splash-name')).toHaveText('Onde Onde');
    const colour = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(colour).not.toBe('rgba(0, 0, 0, 0)');
    expect(colour).not.toBe('rgb(0, 0, 0)');
    expect(colour).toBe(scheme === 'dark' ? 'rgb(18, 20, 17)' : 'rgb(246, 242, 232)');

    await expect(page.getByRole('heading', { name: 'Onde Onde', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(splash).toHaveCount(0);
  });
}

// The dev server needs inline scripts for the app itself, so under the live policy only the
// splash is checked: /splash.js ('self') must run and apply the saved dark choice.
test('splash.js runs under the live Content-Security-Policy', async ({ page, context }) => {
  // The live policy (no inline scripts) on the page itself: the splash must work under it.
  await page.route(
    (url) => !SCRIPT.test(url.pathname) && !url.pathname.startsWith('/api/'),
    async (route) => {
      if (route.request().resourceType() !== 'document') return route.fallback();
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'content-security-policy': contentSecurityPolicy(
            new URL(route.request().url()).origin,
            false,
            'x',
          ),
        },
      });
    },
  );
  const violations: Array<string> = [];
  page.on('console', (message) => {
    if (message.text().includes('splash.js')) violations.push(message.text());
  });
  await markHowItWorksSeen(context);
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/onde-onde', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(violations).toEqual([]);
});
