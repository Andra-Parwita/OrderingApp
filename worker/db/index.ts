// The Repository on Cloudflare D1 (stage 8.1b, D-046/D-047). The Worker serves every route from it (stage 8.4a).
import type { AdminSeller } from '../../shared/authContract';
import type { Seller } from '../../shared/domain';
import { generateOrderCode, generateToken } from '../../shared/orderCode';
import type { Repository, SellerRepository, TokenLookup } from '../repo/Repository';
import { createAuthRepository } from './auth';
import { Db, type D1Like } from './d1';
import { readOrders } from './orders';
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
      const live = await db.first<{ seller_id: string }>(
        'SELECT seller_id FROM orders WHERE token = ? AND past_week_id IS NULL',
        token,
      );
      if (live) {
        const seller = await byId(live.seller_id);
        const sellerRepo = handle(seller);
        const [order] = await readOrders(db, live.seller_id, 'o.token = ?', token);
        if (sellerRepo && order) return { kind: 'live', sellerRepo, order };
      }
      const closed = await db.first<{ seller_id: string }>(
        'SELECT seller_id FROM orders WHERE token = ? AND past_week_id IS NOT NULL',
        token,
      );
      if (closed) await dropExpiredDetails(db, closed.seller_id, options.now());
      const archived = await db.first<{ seller_id: string; cooking_date: string }>(
        `SELECT o.seller_id, p.cooking_date FROM orders o
         JOIN past_weeks p ON p.seller_id = o.seller_id AND p.id = o.past_week_id
         WHERE o.token = ?`,
        token,
      );
      if (archived) {
        const sellerRepo = handle(await byId(archived.seller_id));
        const [order] = await readOrders(db, archived.seller_id, 'o.token = ?', token);
        if (sellerRepo && order) {
          return { kind: 'archived', sellerRepo, order, cookingDate: archived.cooking_date };
        }
      }
      const gone = await db.first<{ seller_id: string; cooking_date: string }>(
        'SELECT seller_id, cooking_date FROM expired_orders WHERE token = ?',
        token,
      );
      const sellerRepo = gone ? handle(await byId(gone.seller_id)) : undefined;
      return gone && sellerRepo
        ? { kind: 'expired', sellerRepo, cookingDate: gone.cooking_date }
        : undefined;
    },

    async liveOrderOwner(token) {
      const row = await db.first<{ seller_id: string }>(
        'SELECT seller_id FROM orders WHERE token = ? AND past_week_id IS NULL',
        token,
      );
      return row?.seller_id;
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
