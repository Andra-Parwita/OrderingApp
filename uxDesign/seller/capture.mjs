// Screenshot every board in every state.
//   npm i -D playwright   (or use one you already have)
//   node capture.mjs                 -> all boards, all states, into ./captures
//   node capture.mjs Main Signin     -> only those boards
//   node capture.mjs --serve         -> just serve ./screens at http://localhost:4173 to browse by hand
//
// States come from each board's Tweaks (data-props): every option of each enum
// and both values of each boolean, one at a time, with the other Tweaks at default.
// Themes (theme/brand) are captured only for the default board state, to keep the count sane.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'screens');
const outDir = path.join(here, 'captures');
const PORT = 4173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const base = `http://localhost:${PORT}`;

const args = process.argv.slice(2);
if (args.includes('--serve')) {
  console.log(`Serving ${root} at ${base}/  (open e.g. ${base}/Main.dc.html)  Ctrl+C to stop.`);
} else {
  // The OrderingApp repo has @playwright/test (which includes chromium), not the bare package.
  const { chromium } = await import('playwright').catch(() => import('@playwright/test'));
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  const only = args.filter((a) => !a.startsWith('--'));
  const boards = index.order.filter((f) => !only.length || only.includes(f.replace('.dc.html', '')));
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1920, height: 1800 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let count = 0;

  for (const file of boards) {
    const name = file.replace('.dc.html', '');
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const m = html.match(/data-props='([^']*)'/);
    const meta = m ? JSON.parse(m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&')) : {};

    await page.goto(`${base}/${file}`);
    await page.waitForFunction(() => document.querySelector('#dc-root')?.firstElementChild, null, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const rootName = await page.evaluate(() => window.__dcRootName());

    const defaults = Object.fromEntries(Object.entries(meta).filter(([, v]) => v && 'default' in v).map(([k, v]) => [k, v.default]));
    const shots = [['default', {}]];
    for (const [k, v] of Object.entries(meta)) {
      if (!v || !v.editor) continue;
      const opts = v.editor === 'enum' ? v.options : v.editor === 'boolean' ? [true, false] : [];
      for (const o of opts) if (o !== v.default) shots.push([`${k}-${o}`, { [k]: o }]);
    }

    for (const [label, override] of shots) {
      await page.evaluate(([n, p]) => window.__dcSetProps(n, p), [rootName, { ...defaults, ...override }]);
      await page.waitForTimeout(250);
      // The board is the first element inside the runtime's wrappers that has its own size.
      const box = await page.evaluate(() => {
        let el = document.querySelector('#dc-root');
        while (el.firstElementChild && el.getBoundingClientRect().width >= window.innerWidth - 1) el = el.firstElementChild;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: Math.ceil(r.width), height: Math.ceil(r.height) };
      });
      await page.screenshot({ path: path.join(outDir, `${name}__${slug(label)}.png`), clip: box });
      count++;
    }
    console.log(`${name}: ${shots.length} states`);
  }
  await browser.close();
  server.close();
  console.log(`\n${count} screenshots in ${outDir}`);
  if (errors.length) console.log(`Page errors:\n- ${[...new Set(errors)].join('\n- ')}`);
}
