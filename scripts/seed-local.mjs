// Applies the migrations to a LOCAL D1 database and (unless --migrate-only) seeds the two sample
// kitchens, Onde Onde and Dapur Demo (stage 8.1b).
//
//   node scripts/seed-local.mjs --local --persist-to <dir> [--migrate-only]
//
// The owner's `pnpm db:migrate:local` / `pnpm db:seed:local` pass `--persist-to .wrangler/state`, the
// state `pnpm dev` (5173) uses. scripts/scratch-server.mjs passes a scratch directory instead.
//
// Safety (conventions section 6): the target is always explicit (the script has no default directory),
// `--remote` is refused, and seeding only ever INSERTS: it stops if the database already has sellers.
// It never deletes anything.
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function stop(message) {
  console.error(`db: ${message}`);
  process.exit(1);
}

if (args.includes('--remote')) stop('refusing --remote: this script only touches a local database');
if (!args.includes('--local')) stop('pass --local');
const flag = args.indexOf('--persist-to');
const target = flag >= 0 ? args[flag + 1] : undefined;
if (target === undefined || target.startsWith('--')) {
  stop('pass --persist-to <directory>: there is no default, so nothing is touched by accident');
}
const migrateOnly = args.includes('--migrate-only');
const allowed = new Set([
  '--local',
  '--persist-to',
  target,
  ...(migrateOnly ? ['--migrate-only'] : []),
]);
const unknown = args.filter((arg) => !allowed.has(arg));
if (unknown.length > 0) stop(`unknown argument: ${unknown.join(' ')}`);

const dir = path.resolve(target);
if (dir === root || root.startsWith(dir + path.sep) || dir === path.parse(dir).root) {
  stop(`${dir} is not a sensible database directory`);
}

const { getPlatformProxy } = await import('wrangler');
const { createServer } = await import('vite');

// The worker code is TypeScript with extensionless imports: vite loads it, no build step.
const vite = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let proxy;
try {
  const { Db } = await vite.ssrLoadModule('/worker/db/d1.ts');
  const { applyMigrations } = await vite.ssrLoadModule('/worker/db/migrate.ts');
  const { fixtureStatements, TABLES_CHILDREN_FIRST } =
    await vite.ssrLoadModule('/worker/db/seed.ts');

  mkdirSync(dir, { recursive: true });
  proxy = await getPlatformProxy({
    configPath: path.join(root, 'wrangler.jsonc'),
    // wrangler's CLI keeps local state under <persist-to>/v3; do the same, so the two agree.
    persist: { path: path.join(dir, 'v3') },
  });
  const d1 = proxy.env.DB;
  const db = new Db(d1);

  const migrationsDir = path.join(root, 'migrations');
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => ({ name: file, sql: readFileSync(path.join(migrationsDir, file), 'utf8') }));
  const applied = await applyMigrations(d1, migrations);
  console.log(`db: ${dir}`);
  console.log(
    `db: migrations applied now: ${applied.length > 0 ? applied.join(', ') : 'none (up to date)'}`,
  );

  if (!migrateOnly) {
    const existing = await db.first('SELECT COUNT(*) AS n FROM sellers');
    if (existing.n > 0)
      stop(`the database already has ${existing.n} seller(s); nothing was seeded`);
    await db.batch(fixtureStatements(db));
    console.log('db: seeded Onde Onde and Dapur Demo');
  }

  for (const table of [...TABLES_CHILDREN_FIRST].reverse()) {
    const row = await db.first(`SELECT COUNT(*) AS n FROM ${table}`);
    console.log(`db: ${table.padEnd(22)} ${row.n}`);
  }
} finally {
  await proxy?.dispose();
  await vite.close();
}
