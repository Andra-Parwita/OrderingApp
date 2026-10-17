// Seeding and wiping. `wipeAndSeed` deletes EVERY row of EVERY table, so it exists only for local
// scratch databases (tests, the seed script) and is guarded: see `createD1Repository`'s `devTools`.
import { blankFixture, fixtureSellers, menuOfFixture, type SellerFixture } from './sampleData';
import type { Seller } from '../../shared/domain';
import type { D1Statement } from './d1';
import { Db } from './d1';
import {
  chefStatement,
  dishStatement,
  itemStatement,
  kitchenStatements,
  menuStatements,
  placeStatement,
  setStatements,
  settingsStatement,
} from './write';

/** Every table, children before parents, so deleting in this order never breaks a foreign key. */
export const TABLES_CHILDREN_FIRST = [
  'day_sales',
  'made_counts',
  'message_log',
  'order_audit',
  'order_inbox',
  'order_lines',
  'orders',
  'expired_orders',
  'past_week_items',
  'past_weeks',
  'customer_sealed_addresses',
  'customer_kitchen_codes',
  'customer_order_links',
  'customer_phone_codes',
  'customer_challenges',
  'customer_sessions',
  'customer_passkeys',
  'customer_accounts',
  'auth_key_redemptions',
  'auth_keys',
  'auth_codes',
  'sessions',
  'devices',
  'memberships',
  'accounts',
  'auth_attempts',
  'auth_challenges',
  'auth_rate',
  'client_log',
  'app_settings',
  'short_messages',
  'saved_set_images',
  'saved_set_dishes',
  'saved_sets',
  'menu_items',
  'menu_pickup_places',
  'pickup_places',
  'menus',
  'dishes',
  'chefs',
  'kitchen_images',
  'kitchen_settings',
  'kitchens',
  'sellers',
] as const;

/**
 * One seller's rows: the seller, kitchen, settings (with theme and menu defaults), chefs, pickup
 * places, the dish library, the menu with its dishes, and the saved sets.
 */
export function sellerSeedStatements(db: Db, fixture: SellerFixture): Array<D1Statement> {
  const sellerId = fixture.seller.id;
  return [
    db.stmt(
      'INSERT INTO sellers (id, slug, name, created_at) VALUES (?, ?, ?, ?)',
      sellerId,
      fixture.seller.slug,
      fixture.seller.name,
      fixture.createdAt,
    ),
    ...kitchenStatements(db, fixture.kitchen, fixture.createdAt),
    settingsStatement(db, sellerId, fixture.settings, fixture.preferences),
    ...fixture.chefs.map((chef, position) => chefStatement(db, chef, position)),
    ...fixture.pickupPlaces.map((place, position) => placeStatement(db, sellerId, place, position)),
    ...menuStatements(db, sellerId, menuOfFixture(fixture)),
    ...fixture.dishes.map((dish) => dishStatement(db, sellerId, dish, fixture.createdAt)),
    // Each menu dish is a copy of the library dish with the same id.
    ...fixture.items.map((item, position) => itemStatement(db, sellerId, item, position, item.id)),
    ...fixture.savedSets.flatMap((set, position) => setStatements(db, sellerId, set, position)),
  ];
}

/** An empty kitchen for a seller the admin just created (the same shape as the sample kitchens). */
export function newSellerStatements(
  db: Db,
  seller: Seller,
  createdAt: string,
  sampleImages = false,
  zone?: string,
): Array<D1Statement> {
  return sellerSeedStatements(db, blankFixture(seller, createdAt, sampleImages, zone));
}

/** The two sample kitchens (Onde Onde, Dapur Demo), their week the coming one from `now`. */
export function fixtureStatements(db: Db, now: Date): Array<D1Statement> {
  return fixtureSellers(now).flatMap((fixture) => sellerSeedStatements(db, fixture));
}

export function wipeStatements(db: Db): Array<D1Statement> {
  return TABLES_CHILDREN_FIRST.map((table) => db.stmt(`DELETE FROM ${table}`));
}

/** Empties the database and inserts the sample kitchens, in one transaction. */
export async function wipeAndSeed(db: Db, now: Date): Promise<void> {
  await db.batch([...wipeStatements(db), ...fixtureStatements(db, now)]);
}
