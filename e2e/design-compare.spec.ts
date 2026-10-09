import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';

// Design-compare checkpoint (plan 001, stage 2b): screenshots the app next to the design
// reference in uxDesign/seller/captures/. It never fails on visual differences, only when a page
// does not load or logs console errors (listed in the index). Add a row to ENTRIES per screen.
// Run: pnpm exec playwright test e2e/design-compare.spec.ts --project=desktop-chromium --no-deps

const TABLET = { width: 1180, height: 820 };
const PHONE = { width: 390, height: 844 };
const SELLER = 'onde-onde';

interface Entry {
  board: string;
  state: string;
  url: string;
  viewport: { width: number; height: number };
  /** Sign in as the dev seller (the dev picker's `devSeller` slug) before opening the page. */
  signedIn?: boolean;
  /** Open this URL first in the same context (sets the last kitchen). */
  visitFirst?: string;
  /** Then click the visible link or button whose text matches this. */
  click?: RegExp;
}

const harness = (screen: string): string => `/?harness=seller-menu&screen=${screen}`;

const ENTRIES: ReadonlyArray<Entry> = [
  { board: 'Patterns', state: 'default', url: '/?harness=patterns', viewport: TABLET },
  { board: 'Main', state: 'default', url: '/seller', viewport: TABLET, signedIn: true },
  { board: 'Phone-Orders', state: 'default', url: '/seller', viewport: PHONE, signedIn: true },
  {
    board: 'Signin',
    state: 'default',
    url: '/seller/sign-in?kitchen=onde-onde',
    visitFirst: '/onde-onde',
    viewport: TABLET,
  },
  {
    board: 'Signin',
    state: 'step-password',
    url: '/seller/sign-in?kitchen=onde-onde',
    visitFirst: '/onde-onde',
    click: /Use password instead/i,
    viewport: TABLET,
  },
  {
    board: 'Signin',
    state: 'step-first-time',
    url: '/seller/sign-in?kitchen=onde-onde',
    visitFirst: '/onde-onde',
    click: /First time/i,
    viewport: TABLET,
  },
  {
    board: 'Signin',
    state: 'device-phone',
    url: '/seller/sign-in?kitchen=onde-onde',
    visitFirst: '/onde-onde',
    viewport: PHONE,
  },
  { board: 'Menu-Home', state: 'default', url: '/seller/menu', viewport: TABLET, signedIn: true },
  {
    board: 'Menu-Dishes',
    state: 'menustate-live',
    url: '/seller/menu/edit/dishes',
    viewport: TABLET,
    signedIn: true,
  },
  {
    board: 'Menu-Details',
    state: 'default',
    url: '/seller/menu/edit/details',
    viewport: TABLET,
    signedIn: true,
  },
  {
    board: 'Menu-Check',
    state: 'default',
    url: harness('make/check'),
    viewport: TABLET,
    signedIn: true,
  },
  {
    board: 'Menu-Publish',
    state: 'default',
    url: harness('make/publish'),
    viewport: TABLET,
    signedIn: true,
  },
  {
    board: 'Menu-Dishes',
    state: 'default',
    url: harness('dishes'),
    viewport: TABLET,
    signedIn: true,
  },
  {
    board: 'Dish-Edit',
    state: 'default',
    url: '/seller/menu/edit/dishes?dish=new',
    viewport: TABLET,
    signedIn: true,
  },
];

const OUT = 'captures/design';
const REFERENCES = '../../uxDesign/seller/captures';

interface Result {
  entry: Entry;
  file: string;
  loaded: boolean;
  errors: Array<string>;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function writeIndex(results: ReadonlyArray<Result>): void {
  const rows = results
    .map((r) => {
      const name = `${r.entry.board}__${r.entry.state}`;
      const errors = r.errors.length
        ? `<ul>${r.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
        : '<p>no console errors</p>';
      return `<section><h2>${name} <small>${r.entry.viewport.width}x${r.entry.viewport.height} ${escapeHtml(r.entry.url)} - ${r.loaded ? 'loaded' : 'FAILED to load'}, ${String(r.errors.length)} console error(s)</small></h2>${errors}
<div class="pair"><figure><figcaption>App</figcaption><img src="${r.file}" alt="app ${name}"></figure>
<figure><figcaption>Reference</figcaption><img src="${REFERENCES}/${name}.png" alt="reference ${name}"></figure></div></section>`;
    })
    .join('\n');
  writeFileSync(
    `${OUT}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Design compare</title>
<style>body{font:14px sans-serif;background:#111;color:#ddd;margin:16px}small{font-weight:normal;color:#999}
.pair{display:flex;gap:16px;align-items:flex-start}figure{margin:0}img{max-width:600px;border:1px solid #444}
li{color:#f88}section{margin-bottom:32px}</style>
<h1>Design compare</h1>\n${rows}\n`,
  );
}

test('design compare: app screens beside the references', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const baseURL = testInfo.project.use.baseURL;
  const results: Array<Result> = [];

  for (const entry of ENTRIES) {
    const file = `${entry.board}__${entry.state}.app.png`;
    const result: Result = { entry, file, loaded: false, errors: [] };
    results.push(result);
    const context = await browser.newContext({
      baseURL,
      viewport: entry.viewport,
      colorScheme: 'dark',
    });
    try {
      // The app's own preference ('theme') wins over the system setting; force dark there too.
      await context.addInitScript(
        ([signedIn, slug]) => {
          localStorage.setItem('theme', 'dark');
          if (signedIn) localStorage.setItem('devSeller', slug ?? '');
        },
        [entry.signedIn ? '1' : '', SELLER],
      );
      const page = await context.newPage();
      page.on('console', (m) => {
        if (m.type() === 'error') result.errors.push(m.text());
      });
      page.on('pageerror', (e) => result.errors.push(e.message));
      if (entry.visitFirst) {
        await page.goto(entry.visitFirst, { waitUntil: 'load' });
        await page.waitForTimeout(500);
      }
      await page.goto(entry.url, { waitUntil: 'load' });
      if (entry.click) {
        await page.getByText(entry.click).first().click({ timeout: 10_000 });
      }
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${file}` });
      result.loaded = true;
    } catch (error) {
      result.errors.push(`load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }

  writeIndex(results);
  const failed = results.filter((r) => !r.loaded);
  if (failed.length) {
    throw new Error(`pages that did not load: ${failed.map((r) => r.file).join(', ')}`);
  }
});
