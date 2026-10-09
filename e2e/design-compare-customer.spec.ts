import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';

// Design-compare checkpoint for the customer app (plan 004): screenshots each `compare: true`
// screen's fixtures page beside the design reference in uxDesign/customer/captures/ (made by
// `node scripts/capture-customer-design.mjs`). It never fails on visual differences, only when a
// page does not load; console errors are listed in the index.
// Run: pnpm exec playwright test e2e/design-compare-customer.spec.ts --project=desktop-chromium --no-deps

interface Screen {
  id: string;
  safeTop?: number;
  safeBottom?: number;
  compare: boolean;
}

const SCREENS = (
  JSON.parse(readFileSync('uxDesign/customer/data/screens.json', 'utf8')) as {
    screens: Array<Screen>;
  }
).screens.filter((s) => s.compare);

const BRAND = 'ondeonde';
const MODE = 'light';
const OUT = 'captures/design-customer';
const REFERENCES = '../../uxDesign/customer/captures';

interface Result {
  screen: Screen;
  file: string;
  loaded: boolean;
  errors: Array<string>;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function writeIndex(results: ReadonlyArray<Result>): void {
  const rows = results
    .map((r) => {
      const id = r.screen.id;
      const errors = r.errors.length
        ? `<ul>${r.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
        : '<p>no console errors</p>';
      return `<section><h2>${id} <small>${r.loaded ? 'loaded' : 'FAILED to load'}, ${String(r.errors.length)} console error(s)</small></h2>${errors}
<div class="pair"><figure><figcaption>App</figcaption><img src="${r.file}" alt="app ${id}"></figure>
<figure><figcaption>Reference</figcaption><img src="${REFERENCES}/${id}__${BRAND}-${MODE}.png" alt="reference ${id}"></figure></div></section>`;
    })
    .join('\n');
  writeFileSync(
    `${OUT}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Design compare, customer</title>
<style>body{font:14px sans-serif;background:#111;color:#ddd;margin:16px}small{font-weight:normal;color:#999}
.pair{display:flex;gap:16px;align-items:flex-start}figure{margin:0}img{max-width:390px;border:1px solid #444}
li{color:#f88}section{margin-bottom:32px}</style>
<h1>Design compare, customer</h1>\n${rows}\n`,
  );
}

test('design compare (customer): fixtures pages beside the references', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const baseURL = testInfo.project.use.baseURL;
  const results: Array<Result> = [];

  for (const screen of SCREENS) {
    const file = `${screen.id}.app.png`;
    const result: Result = { screen, file, loaded: false, errors: [] };
    results.push(result);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      page.on('console', (m) => {
        if (m.type() === 'error') result.errors.push(m.text());
      });
      page.on('pageerror', (e) => result.errors.push(e.message));
      await page.goto(`/__fixtures/${screen.id}?brand=${BRAND}&mode=${MODE}`, {
        waitUntil: 'load',
      });
      // The frame's safe areas: the app gives up this much at the top and bottom.
      await page.evaluate(
        ([top, bottom]) => {
          document.documentElement.style.setProperty('--sat', `${String(top)}px`);
          document.documentElement.style.setProperty('--sab', `${String(bottom)}px`);
        },
        [screen.safeTop ?? 0, screen.safeBottom ?? 0],
      );
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
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
