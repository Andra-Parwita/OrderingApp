import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import { http, HttpResponse, passthrough } from 'msw';
import type { Week } from '../shared/domain';
import type { HealthResponse } from '../shared/health';
import { DEFAULT_SELLER_SLUG } from '../shared/seller';
import { handleApiRequest } from '../worker/api/routes';
import type { Repository, SellerRepository } from '../worker/repo/Repository';
import { makeWorld, openDatabase, type Database, type World } from './impl';

/** The admin setup key, for tests. */
export { DEV_ADMIN_SETUP_KEY } from './impl';

/** `devTools` is on: the tests drive the app as a local dev server runs it. */
export const healthFixture: HealthResponse = {
  status: 'ok',
  time: '2026-10-07T10:00:00.000Z',
  devTools: true,
};

/** A fixed clock: Wed 7 Oct 2026, before the cut-off. */
export const MOCK_NOW = new Date('2026-10-07T10:00:00.000Z');

// ---- One local D1 per test file, opened on first use ----
// The MSW handlers and the tests' own `mockStore` calls share it, so what a screen saves is what the
// test then reads. A file that never touches the API never opens a database. It starts migrated
// and seeded with the sample kitchens; `reset()` puts it back between tests.

let opening: Promise<{ database: Database; world: World }> | undefined;
let closing = false;
const NOW = () => MOCK_NOW;

/** One short directory name per test file, e.g. "seller-menu-itemEditor.test.tsx". */
function scratchName(): string {
  const file = expect.getState().testPath ?? 'unknown';
  const parts = file.replaceAll('\\', '/').split('/').slice(-2);
  return `src-${parts.join('-').replaceAll(/[^\w.-]/g, '_')}`;
}

type Open = { database: Database; world: World };

function opened(): Promise<Open> {
  opening ??= (async () => {
    const database = await openDatabase(scratchName());
    return { database, world: await makeWorld(database, { now: NOW }) };
  })();
  return opening;
}

async function openWorld(): Promise<World> {
  return (await opened()).world;
}

async function resetWorld(): Promise<void> {
  const open = await opened();
  // A fresh repository too: it keeps its own sample-order generator.
  open.world = await makeWorld(open.database, { now: NOW });
}

/**
 * Opens the file's database before its first test when the file looks like it talks to the API
 * (a screen, a store, the client): the first request would otherwise wait for wrangler to start
 * and run into the 1 s default of `findBy*`. A file this misses still works: it opens on demand.
 */
export async function warmWorld(): Promise<void> {
  const file = expect.getState().testPath;
  if (!file || !TALKS_TO_API.test(readFileSync(file, 'utf8'))) return;
  await opened();
}

const TALKS_TO_API =
  /createTestStore|renderWithStore|mockStores?\b|CustomerShell|AppRoutes|SellerPicker|SessionProvider|createAppStore|LabelsScreen|\bfetch\(|from '(\.\.\/)+api\//;

/** Closes the file's database, if it was opened. Called from mocks/setup.ts after the file. */
export async function closeWorld(): Promise<void> {
  const pending = opening;
  opening = undefined;
  closing = true;
  if (pending) await (await pending).database.close();
}

/** MSW handlers for the API, on the same routes and the same D1 repository as the Worker. */
export const apiHandlers = [
  // A resolver that returns nothing falls through, so unknown /api paths still error.
  http.all('*/api/*', async ({ request }) => {
    // The file is done and its database is closing: a late request from an unmounted screen.
    if (closing) return new HttpResponse(null, { status: 503 });
    const { repo } = await openWorld();
    const response = await handleApiRequest(repo, request.clone(), { devTools: true });
    return response ?? undefined;
  }),
];

/** A repository object whose methods wait for the file's database, then call the real one. */
function lazy<T extends object>(get: () => Promise<T>): T {
  return new Proxy({} as T, {
    get: (target, key) => {
      // Own properties (the test helpers) win; a Promise must not find a `then` here.
      if (Reflect.has(target, key)) return Reflect.get(target, key);
      if (typeof key === 'symbol' || key === 'then') return undefined;
      return async (...args: Array<unknown>) => {
        const target = await get();
        const method = Reflect.get(target, key) as (...a: Array<unknown>) => unknown;
        return method.apply(target, args);
      };
    },
  });
}

type StoresTestApi = Repository & {
  /** Back to the two sample kitchens; forgets sellers the admin added and every account. */
  reset(): Promise<void>;
  /** The server forgets every session (as after a restart). */
  forgetSessions(): Promise<void>;
};

/** The whole repository (every seller), for tests that need more than one seller. */
export const mockStores: StoresTestApi = Object.assign(
  lazy<Repository>(async () => (await openWorld()).repo),
  {
    // `auth` is an object, not a method: it gets its own lazy view.
    auth: lazy<Repository['auth']>(async () => (await openWorld()).repo.auth),
    reset: resetWorld,
    forgetSessions: async () => {
      await (await openWorld()).db.stmt('DELETE FROM sessions').run();
    },
  },
);

type DefaultSellerTestApi = Omit<SellerRepository, 'seller'> & {
  reset(): Promise<void>;
  /** Sets the week's status directly, with no rules (a test's way to start in a given state). */
  setWeek(patch: Pick<Week, 'status'>): Promise<void>;
};

async function defaultSeller(): Promise<SellerRepository> {
  const seller = await (await openWorld()).repo.sellerBySlug(DEFAULT_SELLER_SLUG);
  if (!seller) throw new Error('The default seller is missing from the test database');
  return seller;
}

/** The default seller's repository (Onde Onde), for tests that need one seller only. */
export const mockStore: DefaultSellerTestApi = Object.assign(lazy(defaultSeller), {
  reset: resetWorld,
  setWeek: async (patch: Pick<Week, 'status'>) => {
    const { db } = await openWorld();
    const seller = await defaultSeller();
    await db
      .stmt('UPDATE weeks SET status = ? WHERE seller_id = ?', patch.status, seller.seller.id)
      .run();
  },
});

export const handlers = [
  // wrangler's own calls to its local D1 (getPlatformProxy) must reach it, not the API routes.
  http.all('*/cdn-cgi/*', () => passthrough()),
  http.get('*/api/health', () => HttpResponse.json(healthFixture)),
  ...apiHandlers,
];
