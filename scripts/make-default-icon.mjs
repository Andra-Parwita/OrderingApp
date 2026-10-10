// Renders the default app icon (public/app-icon.png, 512x512) with the Playwright already installed.
//   node scripts/make-default-icon.mjs
// Run once; the PNG is kept in git. A muted sage square with a white bowl and steam, inside the
// middle 60 % so the same file works as a maskable icon.
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'app-icon.png');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#5F7A66"/>
<path d="M150 252h212a106 106 0 0 1-106 106 106 106 0 0 1-106-106z" fill="#F6F2E8"/>
<rect x="176" y="368" width="160" height="16" rx="8" fill="#F6F2E8"/>
<g fill="none" stroke="#F6F2E8" stroke-width="14" stroke-linecap="round">
<path d="M216 214c-14-18 14-30 0-48"/><path d="M256 214c-14-18 14-30 0-48"/><path d="M296 214c-14-18 14-30 0-48"/>
</g></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 512, height: 512 } });
await browser.close();
console.log(`wrote ${out}`);
