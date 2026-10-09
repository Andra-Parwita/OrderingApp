// Test harness (stage 8.1b, D-047; D1 only since 8.4a): the Repository on a local D1 that wrangler's
// getPlatformProxy provides. Each test file gets its OWN scratch persist directory under
// scratch/d1-tests/, created in beforeAll and deleted in afterAll. The database is migrated once
// per file and reset to the sample kitchens between tests (`dev.reset`). Nothing here can reach a
// real database: the directory is asserted before anything is opened, and --remote is never used.
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { createD1Repository } from '../worker/db';
import { sha256Hex } from '../worker/db/crypto';
import { Db, type D1Like } from '../worker/db/d1';
import { applyMigrations } from '../worker/db/migrate';
import { trackWrites } from './dirtyTables';
import { handleApiRequest, type RouteContext } from '../worker/api/routes';
import type { Repository } from '../worker/repo/Repository';

/** The admin setup key tests use (the repository is given it as the `ADMIN_SETUP_KEY` secret). */
export const DEV_ADMIN_SETUP_KEY = 'DLV-DEVA-DMIN-SETU-PKEY';

export type TestOptions = {
  now: () => Date;
  newId?: () => string;
  newToken?: () => string;
  newCode?: () => string;
  seed?: number;
};

/** One fresh world (the two sample kitchens, no orders, no accounts) for one test. */
export type World = {
  repo: Repository;
  /** The raw database, for the few tests that bend a row the API cannot. */
  db: Db;
  /** Back to the sample kitchens; forgets sellers the admin added and every account. */
  reset(): Promise<void>;
  /** The stored sign-in secrets as JSON, to prove nothing is kept in plain text. */
  dumpSecrets(): Promise<string>;
  /** When the session for a token expires (ms since epoch). */
  expiryOf(token: string): Promise<number | undefined>;
};

const ROOT = path.resolve('scratch');
const MIGRATIONS = path.resolve('migrations');

/** The scratch directory for one test file; refuses anything outside scratch/d1-tests/. */
function scratchDir(name: string): string {
  const dir = path.resolve(ROOT, 'd1-tests', name);
  const relative = path.relative(path.resolve(ROOT, 'd1-tests'), dir);
  if (!/^[\w.-]+$/.test(name) || relative !== name || relative.startsWith('..')) {
    throw new Error(`Refusing to use ${dir} as a test database directory`);
  }
  return dir;
}

// wrangler is loaded by a variable name on purpose: importing its (huge) types into the app
// program made `eslint .` run out of memory. Only what is used here is declared.
type Proxy = { env: Record<string, unknown>; dispose: () => Promise<void> };
type Wrangler = {
  getPlatformProxy: (options: { configPath: string; persist: { path: string } }) => Promise<Proxy>;
};
const WRANGLER = 'wrangler';
/**
 * In a jsdom test the global Uint8Array is jsdom's own, which esbuild (loaded by wrangler) refuses
 * ("TextEncoder().encode() instanceof Uint8Array is false"). Node's own class is put back for the
 * time wrangler loads and starts, then jsdom's returns.
 */
async function withNodeTypedArrays<T>(run: () => Promise<T>): Promise<T> {
  const nodeUint8Array = (
    Object.getPrototypeOf(Buffer.prototype) as { constructor: Uint8ArrayConstructor }
  ).constructor;
  const jsdomUint8Array = globalThis.Uint8Array;
  globalThis.Uint8Array = nodeUint8Array;
  try {
    return await run();
  } finally {
    globalThis.Uint8Array = jsdomUint8Array;
  }
}

const loadWrangler = async () => (await import(/* @vite-ignore */ WRANGLER)) as Wrangler;

/** A migrated local D1 in its own scratch directory, and how to remove it. */
export type Database = {
  d1: D1Like;
  /** The sample kitchens, no orders, no accounts; touches only the tables a test wrote to. */
  reset(): Promise<void>;
  /** Marks the database as just fully reset (after the repository's own `dev.reset`). */
  markFresh(): void;
  close(): Promise<void>;
};

export async function openDatabase(name: string): Promise<Database> {
  const dir = scratchDir(name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const proxy = await withNodeTypedArrays(async () => {
    const { getPlatformProxy } = await loadWrangler();
    return getPlatformProxy({ configPath: 'wrangler.jsonc', persist: { path: dir } });
  });
  const d1 = proxy.env['DB'] as D1Like;
  const files = readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql'));
  const migrations = files.map((file) => ({
    name: file,
    sql: readFileSync(path.join(MIGRATIONS, file), 'utf8'),
  }));
  await applyMigrations(d1, migrations);
  const tracked = trackWrites(
    d1,
    migrations.map((migration) => migration.sql),
  );
  await tracked.reset();
  return {
    d1: tracked.d1,
    reset: () => tracked.reset(),
    markFresh: () => tracked.markFresh(),
    close: async () => {
      await proxy.dispose();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** The sample kitchens, no orders, no accounts: a fresh world on an open database. */
export async function makeWorld(database: Database, options: TestOptions): Promise<World> {
  const db = new Db(database.d1);
  // The repository's own dev tools (reset, sample orders) are on: this is a scratch database.
  const repo = createD1Repository(database.d1, {
    ...options,
    adminSetupKey: DEV_ADMIN_SETUP_KEY,
    devTools: true,
  });
  await database.reset();
  return {
    repo,
    db,
    // The repository's own dev reset also forgets the sample-order generator it keeps.
    reset: async () => {
      await repo.dev.reset();
      database.markFresh();
    },
    dumpSecrets: async () => {
      const [keys, codes, accounts] = await Promise.all([
        db.all('SELECT * FROM auth_keys'),
        db.all('SELECT * FROM auth_codes'),
        db.all<{
          id: string;
          role: string;
          password_salt: string | null;
          password_hash: string | null;
          password_iterations: number | null;
        }>('SELECT id, role, password_salt, password_hash, password_iterations FROM accounts'),
      ]);
      return JSON.stringify({
        keys,
        codes,
        accounts: accounts.map((row) => ({
          id: row.id,
          role: row.role,
          ...(row.password_hash
            ? {
                password: {
                  salt: row.password_salt,
                  hash: row.password_hash,
                  iterations: row.password_iterations,
                },
              }
            : {}),
        })),
      });
    },
    expiryOf: async (token) => {
      const row = await db.first<{ expires_at: string }>(
        'SELECT expires_at FROM sessions WHERE token_hash = ?',
        await sha256Hex(token),
      );
      return row ? Date.parse(row.expires_at) : undefined;
    },
  };
}

/**
 * Call inside a `describe`. Returns the factory that makes a fresh world per test. It starts a
 * local D1 once for the file (beforeAll) and removes it afterwards (afterAll).
 */
export function useWorld(fileName: string): (o: TestOptions) => Promise<World> {
  let database: Database | undefined;

  beforeAll(async () => {
    database = await openDatabase(`${fileName}-d1`);
  }, 60_000);

  afterAll(async () => {
    await database?.close();
  }, 30_000);

  return (options) => {
    if (!database) throw new Error('The local D1 is not open');
    return makeWorld(database, options);
  };
}

/** The routes with the dev tools on, as a local dev server runs them (DEV_TOOLS=1). */
export function devApi(
  repo: Repository,
  request: Request,
  context: RouteContext = {},
): Promise<Response | null> {
  return handleApiRequest(repo, request, { devTools: true, ...context });
}
