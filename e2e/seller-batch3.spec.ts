import { expect, test, type Page } from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// The batch 3 screens through the app's real routes, after plan 001: the Menu screen, Settings
// (Kitchen pictures, Backup) and Kitchen's Print labels. It looks at the second sample seller
// (Dapur Demo) only, so other specs keep Onde Onde's menu, and it changes and orders nothing.
// These are tablet and computer screens (a phone shows "Open this on a tablet or computer").

const SELLER = 'dapur-demo';

test.skip(({ viewport }) => (viewport?.width ?? 0) < 600, 'tablet and desktop only');

async function open(page: Page, path: string) {
  await page.addInitScript((slug) => localStorage.setItem('devSeller', slug), SELLER);
  await page.goto(path);
}

test('menu, then Settings: pictures and backup, and Kitchen: print labels', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const seller = page.getByRole('navigation', { name: 'Seller' });

  // Menu: the live menu with its dishes and the tools around it.
  await open(page, '/seller');
  await seller.getByRole('link', { name: 'Menu', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/menu$/);
  await expect(seller.getByRole('link', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Dishes on the live menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Your dishes · \d+$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Saved sets · \d+$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish menu now' })).toBeVisible();
  await page.screenshot({ path: `captures/b3-menu-${project}.png`, fullPage: true });

  // Settings > Kitchen: the five picture slots in their new sizes.
  await seller.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/settings\/kitchen$/);
  await expect(seller.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const sizes: Record<string, string> = {
    'Wide banner (tablet and computer)': 'Best size 2000 × 400 px',
    'Phone banner': 'Best size 1200 × 400 px',
    'Menu image (left menu)': 'Best size 1200 × 600 px',
    'Small icon (closed menu)': 'Best size 512 × 512 px',
    'Background (wide screens)': 'Best size 1280 × 256 px',
  };
  for (const [slot, size] of Object.entries(sizes)) {
    await expect(page.getByRole('heading', { name: slot })).toBeVisible();
    await expect(page.getByText(size)).toBeVisible();
  }
  await page.screenshot({ path: `captures/b3-images-${project}.png`, fullPage: true });

  // Settings > Backup.
  await page.getByRole('link', { name: /^Backup/ }).click();
  await expect(page).toHaveURL(/\/seller\/settings\/backup$/);
  await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose backup file' })).toBeVisible();
  await page.screenshot({ path: `captures/b3-backup-${project}.png`, fullPage: true });

  // Kitchen > Print labels: the paper and order choices and the preview.
  await seller.getByRole('link', { name: 'Kitchen', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/cook$/);
  await page.getByRole('button', { name: 'Print labels' }).click();
  await expect(page).toHaveURL(/\/seller\/labels$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Print labels' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'A4 sheet (2 × 7 labels)' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Label printer (62 mm roll)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Preview · / })).toBeVisible();
  await page.screenshot({ path: `captures/b3-labels-${project}.png`, fullPage: true });

  expect(errors).toEqual([]);
});
