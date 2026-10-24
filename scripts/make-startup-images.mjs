// Draws the iOS launch pictures (apple-touch-startup-image) for one app kind into public/startup/<kind>/.
// Dev-only: `node scripts/make-startup-images.mjs [kind]` (default kitchen), then commit the PNGs.
// Settings per kind: scripts/startup-images/<kind>.json. The <link> tags are in index.html. Guide: docs/guide/launch-pictures.md.
// Deterministic: the gradient is drawn per pixel (optional fixed ordered dither, no randomness).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recompressPng } from './startup-images/pngRecompress.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2] ?? 'kitchen';
const cfg = JSON.parse(readFileSync(join(root, 'scripts/startup-images', `${kind}.json`), 'utf8'));
const outDir = join(root, 'public', 'startup', kind);
const iconFile = join(root, cfg.icon);
const mime = iconFile.endsWith('.png') ? 'image/png' : 'image/webp';
const icon = `data:${mime};base64,${readFileSync(iconFile).toString('base64')}`;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// iPhone 14 and newer, portrait, CSS px (all 3x). Keep in step with the <link> tags in index.html.
export const sizes = [
  [390, 844],
  [393, 852],
  [402, 874],
  [420, 912],
  [428, 926],
  [430, 932],
  [440, 956],
];

const html = (w, h) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${cfg.font.family.replace(/ /g, '+')}:wght@${cfg.font.weight}&display=block">
<style>
html,body{margin:0;height:100%;background:${cfg.edgeColor};overflow:hidden}
canvas{position:absolute;inset:0;width:${w}px;height:${h}px}
.g{position:absolute;left:0;right:0;top:${cfg.spotlight.centerYPercent}%;transform:translateY(-50%);display:flex;flex-direction:column;
align-items:center;gap:${cfg.gap};color:${cfg.nameColor};
font-family:'${cfg.font.family}',system-ui,-apple-system,'Segoe UI',sans-serif}
img{width:${cfg.iconSize}px;height:${cfg.iconSize}px;object-fit:contain}
span{font-size:${cfg.font.size};font-weight:${cfg.font.weight};letter-spacing:${cfg.font.letterSpacing}}
</style></head><body><canvas id="c"></canvas>
<div class="g"><img src="${icon}" alt=""><span>${cfg.name}</span></div>
<script>
const W=${w}*3,H=${h}*3,c=document.getElementById('c');c.width=W;c.height=H;
const x=c.getContext('2d'),d=x.createImageData(W,H);
const edge=${JSON.stringify(rgb(cfg.edgeColor))},mid=${JSON.stringify(rgb(cfg.centerColor))};
const cx=W/2,cy=H*${cfg.spotlight.centerYPercent / 100},R=W*${cfg.spotlight.radiusWidthFactor},amp=${cfg.dither};
const bayer=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,
3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
for(let j=0;j<H;j++)for(let i=0;i<W;i++){
 const cdx=(i-W/2)/(W/2),cdy=(j-H/2)/(H/2);
 const dark=1-${cfg.cornerDarken}*(cdx*cdx+cdy*cdy)/2-${cfg.bottomDarken}*Math.max(0,cdy);
 const t=Math.min(1,Math.hypot(i-cx,j-cy)/R),s=1-t*t*(3-2*t);
 const dt=amp*((bayer[(j&7)*8+(i&7)]+0.5)/64-0.5),o=(j*W+i)*4;
 for(let k=0;k<3;k++){const v=(edge[k]*dark)*(1-s)+mid[k]*s;d.data[o+k]=Math.max(0,Math.min(255,Math.floor(v+0.5+dt)));}
 d.data[o+3]=255;
}
x.putImageData(d,0,0);
</script></body></html>`;

mkdirSync(outDir, { recursive: true });
const keep = new Set(sizes.map(([w, h]) => `startup-${w}x${h}.png`));
for (const f of readdirSync(outDir))
  if (f.endsWith('.png') && !keep.has(f)) unlinkSync(join(outDir, f));

const browser = await chromium.launch();
let fontOk = true;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.setContent(html(w, h), { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  if (
    !(await page.evaluate((f) => document.fonts.check(`${f.weight} 16px '${f.family}'`), cfg.font))
  )
    fontOk = false;
  await page.waitForFunction(() => document.querySelector('img').complete);
  writeFileSync(
    join(outDir, `startup-${w}x${h}.png`),
    recompressPng(await page.screenshot({ type: 'png' })),
  );
  await ctx.close();
}
await browser.close();
console.log(
  fontOk ? `${cfg.font.family} loaded.` : 'WARNING: font not loaded (offline?), system font used.',
);
