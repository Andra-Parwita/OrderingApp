// Starts a THROWAWAY dev server on its own port with its own local database (stage 8.4a).
//
//   node scripts/scratch-server.mjs --port 5181 --dir scratch/e2e-d1
//   node scripts/scratch-server.mjs --port 5199 --dir scratch/smoke-5199
//
// What it does, in order: refuses any directory that is not under scratch/ (and port 5173, which is
// the owner's `pnpm dev`); deletes that directory; migrates it and seeds the two sample kitchens
// (scripts/seed-local.mjs); starts vite with DELAVE_PERSIST_DIR pointing at it and the dev tools
// switched on (DEV_TOOLS=1 and a known ADMIN_SETUP_KEY, passed as process variables, so no
// `.dev.vars` is needed or touched). The owner's `.wrangler/state` is never read or written.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

function stop(message) {
  console.error(`scratch-server: ${message}`);
  process.exit(1);
}

const port = Number(option('--port'));
const dirArg = option('--dir');
if (!Number.isInteger(port) || port < 1024 || port > 65535) stop('pass --port <number>');
if (port === 5173) stop("port 5173 is the owner's dev server");
if (dirArg === undefined) stop('pass --dir scratch/<name>');

const scratch = path.join(root, 'scratch');
const dir = path.resolve(root, dirArg);
const inside = path.relative(scratch, dir);
if (
  inside === '' ||
  inside.startsWith('..') ||
  path.isAbsolute(inside) ||
  inside.includes(path.sep)
) {
  stop(`${dir} is not a directory directly under ${scratch}`);
}
if (!/^(e2e|smoke)[\w-]*$/.test(inside))
  stop(`the directory name must start with "e2e" or "smoke"`);
if (dir.includes('.wrangler')) stop('never .wrangler');

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// Migrates and seeds, with a persist layout the vite plugin reads (<dir>/v3).
const seeded = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'seed-local.mjs'), '--local', '--persist-to', dir],
  { cwd: root, stdio: 'inherit' },
);
if (seeded.status !== 0) stop('migrating and seeding failed');
if (!existsSync(path.join(dir, 'v3'))) stop(`no database was created under ${dir}`);

const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [vite], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(port),
    DELAVE_PERSIST_DIR: dir,
    // The Worker reads these as variables: process values count only with this switch.
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
    DEV_TOOLS: '1',
    ADMIN_SETUP_KEY: 'DLV-DEVA-DMIN-SETU-PKEY',
  },
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(signal, () => child.kill());
child.on('exit', (code) => process.exit(code ?? 0));
