// The Repository on Cloudflare D1 (stage 8.1b, D-046/D-047). The Worker serves every route from it (stage 8.4a).
import type { AdminSeller } from '../../shared/authContract';
import type { Seller, SellerOrder } from '../../shared/domain';
import { keepsOrderDetails } from '../../shared/pastWeeks';
import { generateOrderCode, generateToken } from '../../shared/orderCode';
import type { Repository, SellerRepository, TokenLookup } from '../repo/Repository';
import { createAuthRepository } from './auth';
import { Db, marks, type D1Like } from './d1';
import { assembleOrders, orderReadStatements } from './orders';
import { dropExpiredDetails } from './retention';
import { newSellerStatements, wipeAndSeed } from './seed';
import { createSellerInternal, type Deps, type SampleState, type SellerInternal } from './seller';

export type D1RepositoryOptions = {
  /** Injected clock; the repository never reads the real time. */
  now: () => Date;
  /** The `ADMIN_SETUP_KEY` secret (a Worker secret, or `.dev.vars` locally). */
  adminSetupKey: string;
  newId?: () => string;
  newCode?: () => string;
  newToken?: () => string;
  /** Seed of the pseudo-random source behind the dev sample orders. */
  seed?: number;
  /**
   * Turns on `dev.reset` (deletes EVERY row, then inserts the sample kitchens) and sample
   * orders. Off by default; only tests and local scratch databases set it.
   */
  devTools?: boolean;
};

type SellerRow = { id: string; slug: string; name: string; created_at: string };

export function createD1Repository(d1: D1Like, options: D1RepositoryOptions): Repository {
  const db = new Db(d1);
  const samples = new Map<string, SampleState>();
  const deps: Deps = {
    db,
    now: options.now,
    newId: options.newId ?? (() => crypto.randomUUID()),
    newCode: options.newCode ?? (() => generateOrderCode()),
    newToken: options.newToken ?? (() => generateToken()),
    seed: options.seed ?? 20261011,
    samples,
  };

  const internal = (row: Seller | undefined): SellerInternal | undefined =>
    row ? createSellerInternal(deps, { id: row.id, slug: row.slug, name: row.name }) : undefined;
  const handle = (row: Seller | undefined): SellerRepository | undefined => internal(row)?.repo;
  const byId = (id: string) =>
    db
      .first<Seller>('SELECT id, slug, name FROM sellers WHERE id = ?', id)
      .then((r) => r ?? undefined);

  const requireDevTools = () => {
    if (options.devTools !== true) throw new Error('Dev tools are off for this repository');
  };

  type LookupRows = {
    orders: Array<SellerOrder>;
    dates: Map<string, string>;
    gone: Map<string, { sellerId: string; cookingDate: string }>;
    sellers: Map<string, Seller>;
  };

  /** One round trip for up to 40 tokens: their orders, closed-week dates, stubs and sellers. */
  async function readTokens(tokens: Array<string>): Promise<LookupRows> {
    const m = marks(tokens.length);
    const results = await db.reads([
      ...orderReadStatements(db, `o.token IN (${m})`, tokens),
      db.stmt(
        `SELECT o.token, p.cooking_date FROM orders o JOIN past_weeks p
         ON p.seller_id = o.seller_id AND p.id = o.past_week_id WHERE o.token IN (${m})`,
        ...tokens,
      ),
      db.stmt(
        `SELECT token, seller_id, cooking_date FROM expired_orders WHERE token IN (${m})`,
        ...tokens,
      ),
      db.stmt(
        `SELECT id, slug, name FROM sellers WHERE id IN
           (SELECT seller_id FROM orders WHERE token IN (${m}) UNION SELECT seller_id FROM expired_orders WHERE token IN (${m}))`,
        ...tokens,
        ...tokens,
      ),
    ]);
    return {
      orders: assembleOrders(results.slice(0, 4)),
      dates: new Map(
        (results[4] as Array<{ token: string; cooking_date: string }>).map((r) => [
          r.token,
          r.cooking_date,
        ]),
      ),
      gone: new Map(
        (results[5] as Array<{ token: string; seller_id: string; cooking_date: string }>).map(
          (r) => [r.token, { sellerId: r.seller_id, cookingDate: r.cooking_date }],
        ),
      ),
      sellers: new Map((results[6] as Array<Seller>).map((row) => [row.id, row])),
    };
  }

  /** Where each token leads (D-044). Unknown tokens are left out of the map. */
  async function lookupMany(tokens: ReadonlyArray<string>): Promise<Map<string, TokenLookup>> {
    const wanted = [...new Set(tokens)];
    const found = new Map<string, TokenLookup>();
    for (let from = 0; from < wanted.length; from += 40) {
      const group = wanted.slice(from, from + 40);
      let rows = await readTokens(group);
      // An order of a closed week past its keep date is archived first (retention), then read again.
      if ([...rows.dates.values()].some((date) => !keepsOrderDetails(date, options.now()))) {
        await dropExpiredDetails(db, options.now());
        rows = await readTokens(group);
      }
      for (const token of group) {
        const order = rows.orders.find((candidate) => candidate.token === token);
        const sellerRow = rows.sellers.get(order?.sellerId ?? rows.gone.get(token)?.sellerId ?? '');
        const sellerRepo = handle(sellerRow);
        if (!sellerRepo) continue;
        const cookingDate = rows.dates.get(token);
        if (order) {
          found.set(
            token,
            cookingDate === undefined
              ? { kind: 'live', sellerRepo, order }
              : { kind: 'archived', sellerRepo, order, cookingDate },
          );
          continue;
        }
        const stub = rows.gone.get(token);
        if (stub) found.set(token, { kind: 'expired', sellerRepo, cookingDate: stub.cookingDate });
      }
    }
    return found;
  }

  return {
    async listSellers() {
      return db.all<Seller>('SELECT id, slug, name FROM sellers ORDER BY rowid');
    },

    async adminSellers() {
      const rows = await db.all<SellerRow>(
        'SELECT id, slug, name, created_at FROM sellers ORDER BY rowid',
      );
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        createdAt: row.created_at,
      }));
    },

    async sellerBySlug(slug) {
      return handle(
        (await db.first<Seller>('SELECT id, slug, name FROM sellers WHERE slug = ?', slug)) ??
          undefined,
      );
    },

    async sellerById(id) {
      return handle(await byId(id));
    },

    /** The caller has checked the slug (valid, unique). */
    async addSeller(name, slug): Promise<AdminSeller> {
      const seller: Seller = { id: `seller-${slug}`, slug, name };
      const createdAt = options.now().toISOString();
      await db.batch(newSellerStatements(db, seller, createdAt));
      return { ...seller, createdAt };
    },

    /** Tokens are globally unique: the lookup finds the order's seller. Live, then archived. */
    async lookupByToken(token): Promise<TokenLookup | undefined> {
      return (await lookupMany([token])).get(token);
    },

    lookupByTokens: lookupMany,

    /** For backup restore: which seller holds a live order with each of these tokens. */
    async liveOrderOwners(tokens) {
      const wanted = [...new Set(tokens)];
      const groups: Array<Array<string>> = [];
      for (let from = 0; from < wanted.length; from += 90)
        groups.push(wanted.slice(from, from + 90));
      const results = await db.batch(
        groups.map((group) =>
          db.stmt(
            `SELECT token, seller_id FROM orders WHERE past_week_id IS NULL AND token IN (${marks(group.length)})`,
            ...group,
          ),
        ),
      );
      const owners = new Map<string, string>();
      for (const rows of results) {
        for (const row of rows as Array<{ token: string; seller_id: string }>) {
          owners.set(row.token, row.seller_id);
        }
      }
      return owners;
    },

    auth: createAuthRepository({
      db,
      now: options.now,
      adminSetupKey: options.adminSetupKey,
    }),

    dev: {
      async addSampleOrders(sellerId, count) {
        requireDevTools();
        const row = await byId(sellerId);
        return (await internal(row)?.addSampleOrders(count)) ?? 0;
      },
      async reset() {
        requireDevTools();
        samples.clear();
        await wipeAndSeed(db);
      },
    },
  };
}
