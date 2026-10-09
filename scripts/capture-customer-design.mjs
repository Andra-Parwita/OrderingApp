// Screenshots every `compare: true` screen of the customer design boards, phone chrome hidden,
// at 390 x 844, into uxDesign/customer/captures/<screenId>__<brand>-<mode>.png (git-ignored).
//   node scripts/capture-customer-design.mjs                 -> ondeonde light and dark
//   node scripts/capture-customer-design.mjs bali:dark       -> only those brand:mode pairs
// A tiny static server (port 4174) serves uxDesign/customer/design; no `npx serve`.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const customer = path.join(here, '..', 'uxDesign', 'customer');
const root = path.join(customer, 'design');
const outDir = path.join(customer, 'captures');
const PORT = 4174;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const BRANDS = ['ondeonde', 'bali', 'sumatra', 'sunda', 'jawa'];
const requested = process.argv.slice(2);
const combos = requested.length
  ? requested.map((a) => a.split(':'))
  : [
      ['ondeonde', 'light'],
      ['ondeonde', 'dark'],
    ];

let count = 0;
let browser;
try {
  const { chromium } = await import('@playwright/test');
  const screens = JSON.parse(
    fs.readFileSync(path.join(customer, 'data', 'screens.json'), 'utf8'),
  ).screens.filter((s) => s.compare);
  fs.mkdirSync(outDir, { recursive: true });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const boards = [...new Set(screens.map((s) => s.board))];
  for (const [brand, mode] of combos) {
    for (const board of boards) {
      await page.goto(`http://localhost:${PORT}/${board}`);
      await page.waitForSelector('.scr', { timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      // Theme: the board's root element carries `th <brand> <light|dark>`.
      await page.evaluate(
        ([b, m, brands]) => {
          for (const el of document.querySelectorAll('.th')) {
            el.classList.remove(...brands, 'light', 'dark');
            el.classList.add(b, m);
          }
          const style = document.createElement('style');
          style.textContent =
            '.sb, .asb, .di, .ph, .hi, .ahi { visibility: hidden !important } .scr { border-radius: 0 !important }';
          document.head.appendChild(style);
        },
        [brand, mode, BRANDS],
      );
      await page.waitForTimeout(300);
      const frames = page.locator('.scr');
      for (const screen of screens.filter((s) => s.board === board)) {
        const frame = frames.nth(screen.frame - 1);
        await frame.screenshot({
          path: path.join(outDir, `${screen.id}__${brand}-${mode}.png`),
          animations: 'disabled',
        });
        count += 1;
      }
    }
  }
  if (errors.length) console.log(`page errors: ${errors.length}\n${errors.slice(0, 5).join('\n')}`);
} finally {
  await browser?.close();
  server.close();
}
console.log(`captured ${count} screens into ${outDir}`);
