import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { formatVersion } from './shared/buildInfo';

// Plan 020: the app version, from package.json (major.minor) and git (count, commit, draft).
function gitOut(command: string): string | null {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null; // no git (a tarball) or no commits
  }
}
const gitCount = gitOut('git rev-list --count HEAD');
const appVersion = formatVersion({
  packageVersion: (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
  count: gitCount === null ? null : Number(gitCount),
  commit: gitOut('git rev-parse --short HEAD'),
  draft: (gitOut('git status --porcelain') ?? '') !== '',
});

// `pnpm build` (and so `pnpm deploy`) prints it, to see which version is about to go live.
if (process.argv.includes('build')) console.log(`App version: ${appVersion}`);

const https = {
  cert: readFileSync('.certs/dev.pem'),
  key: readFileSync('.certs/dev-key.pem'),
};

// Playwright and the smoke test start their own servers on other ports (PORT env), see
// playwright.config.ts and scripts/scratch-server.mjs.
const port = Number(process.env['PORT'] ?? 5173);

// `pnpm dev` (5173) keeps the Worker's local D1, R2 and Durable Object state in the default
// `.wrangler/state`: the owner's dev data. A server on another port gets its own directory through
// DELAVE_PERSIST_DIR (set by scripts/scratch-server.mjs), which must sit under `scratch/`, so a
// stray value can never point a throwaway server at the owner's data.
function persistState(): { path: string } | undefined {
  const dir = process.env['DELAVE_PERSIST_DIR'];
  if (dir === undefined || dir === '') return undefined;
  const scratch = path.resolve('scratch');
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(scratch + path.sep) || resolved.includes('.wrangler')) {
    throw new Error(`DELAVE_PERSIST_DIR must be a directory under scratch/, got ${resolved}`);
  }
  if (port === 5173) {
    throw new Error("Port 5173 is the owner's dev server: it never uses a scratch database");
  }
  return { path: resolved };
}

const persist = persistState();

// Plan 011: no dev hook for the kitchen links. With `assets.run_worker_first` the Cloudflare plugin
// runs the Worker for pages in dev too, so the same HTMLRewriter code (worker/pages.ts) serves
// phones on the home Wi-Fi, with the kitchen name and the `/o/:token` links as well.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react(), cloudflare(persist ? { persistState: persist } : {})],
  server: {
    https,
    host: true,
    port,
    strictPort: true,
    // Non-code folders: watching them on Windows keeps them open and blocks renames.
    watch: { ignored: ['**/uxDesign/**', '**/temp/**', '**/docs/**', '**/briefs/**'] },
  },
  preview: { https, host: true, port, strictPort: true },
});
