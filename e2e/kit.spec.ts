import { expect, test } from '@playwright/test';

for (const scheme of ['light', 'dark'] as const) {
  test(`UI kit gallery renders in ${scheme} with a visible focus ring`, async ({
    page,
  }, testInfo) => {
    const consoleErrors: Array<string> = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/?harness=kit');
    await expect(
      page.getByRole('radio', { name: scheme === 'dark' ? 'Dark' : 'Light' }),
    ).toHaveAttribute('aria-checked', 'true');

    // Keyboard modality first, so :focus-visible applies to the programmatic focus.
    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Secondary', exact: true });
    await button.focus();
    await expect(button).toHaveCSS('outline-style', 'solid');
    await expect(button).toHaveCSS('outline-width', '2px');

    await page.screenshot({
      path: `captures/kit-${scheme}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    if (testInfo.project.name === 'desktop-chromium') {
      await page.screenshot({ path: `captures/kit-${scheme}.png`, fullPage: true });
    }
    expect(consoleErrors).toEqual([]);
  });
}
