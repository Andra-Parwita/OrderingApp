// Plan 119: proves customers do not download the seller/admin code.
// Builds with source maps into scratch/bundle-check/, then fails if the entry chunk (the one
// index.html loads) contains a staff module, or is over the size limit. No dependency.
// Run: pnpm run check:bundle
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const OUT = 'scratch/bundle-check';
const MAX_ENTRY_KB = 1100; // raw; light split (the full split would be 900)
// Light split (no store split): the seller slices and sagas (.ts) stay in the entry because the
// one Redux store wires them. Any seller screen or component (.tsx), and all of admin, must not.
const FORBIDDEN = [
  /src\/features\/seller-[^/]+\/.*\.tsx$/,
  /src\/features\/admin(\/|$)/,
  /src\/app\/(sellerRoutes|adminRoutes|AuthRoutes|SellerLayout|StaffArea)/,
];

rmSync(OUT, { recursive: true, force: true });
execSync(`pnpm exec vite build --outDir ${OUT} --sourcemap`, { stdio: 'inherit' });

function findFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) findFiles(p, out);
    else out.push(p);
  }
  return out;
}

const files = findFiles(OUT);
const indexHtml = files.find((f) => f.endsWith('index.html'));
if (!indexHtml) throw new Error(`No index.html under ${OUT}`);
const html = readFileSync(indexHtml, 'utf8');
const entryRef = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
if (!entryRef) throw new Error('No module script in index.html');
const entryPath = path.join(path.dirname(indexHtml), entryRef.replace(/^\//, ''));
if (!existsSync(entryPath)) throw new Error(`Entry chunk not found: ${entryPath}`);

const entry = readFileSync(entryPath);
const map = JSON.parse(readFileSync(`${entryPath}.map`, 'utf8'));
const kb = (n) => (n / 1024).toFixed(1);

console.log('\nChunks (js, raw KB):');
for (const f of files.filter((x) => x.endsWith('.js')).sort()) {
  console.log(`  ${kb(statSync(f).size).padStart(8)}  ${path.relative(OUT, f)}`);
}
console.log(
  `\nEntry ${path.basename(entryPath)}: ${kb(entry.length)} KB raw, ${kb(gzipSync(entry).length)} KB gzip (limit ${MAX_ENTRY_KB} KB raw)`,
);

const problems = [];
const leaked = map.sources
  .map((s) => s.split(String.fromCharCode(92)).join('/'))
  .filter((s) => FORBIDDEN.some((re) => re.test(s)));
for (const s of leaked) problems.push(`staff module in the entry chunk: ${s}`);
if (entry.length > MAX_ENTRY_KB * 1024) {
  problems.push(`entry is ${kb(entry.length)} KB raw, over ${MAX_ENTRY_KB} KB`);
}
if (problems.length > 0) {
  console.error(`\ncheck:bundle FAILED\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\ncheck:bundle OK');
