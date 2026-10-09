// INSERT statements for a seller's configuration rows (kitchen, settings, week, chefs, menu, saved
// sets). Shared by seeding, adding a seller and restoring a backup.
import type { Chef, Kitchen, KitchenSettings, MenuItem, Week } from '../../shared/domain';
import { IMAGE_SLOTS } from '../../shared/imageSlots';
import type { SavedSet, SavedSetItem } from '../../shared/setupContract';
import type { Db, D1Statement } from './d1';

export function kitchenStatements(db: Db, kitchen: Kitchen, at: string): Array<D1Statement> {
  const sellerId = kitchen.sellerId;
  const images = kitchen.images ?? {};
  const statements = [
    db.stmt(
      `INSERT INTO kitchens (seller_id, name, tagline_en, tagline_id, banner_image_url, banner_background, image_alt_en, image_alt_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      sellerId,
      kitchen.name,
      kitchen.tagline.en,
      kitchen.tagline.id,
      kitchen.bannerImageUrl ?? null,
      images.bannerBackground ?? null,
      images.alt?.en ?? '',
      images.alt?.id ?? '',
    ),
  ];
  for (const slot of IMAGE_SLOTS) {
    const ref = images[slot];
    if (ref === undefined) continue;
    statements.push(
      db.stmt(
        'INSERT INTO kitchen_images (seller_id, slot, ref, updated_at) VALUES (?, ?, ?, ?)',
        sellerId,
        slot,
        ref,
        at,
      ),
    );
  }
  return statements;
}

export function settingsStatement(db: Db, sellerId: string, s: KitchenSettings): D1Statement {
  return db.stmt(
    `INSERT INTO kitchen_settings (seller_id, whatsapp_number, post_greeting_en, post_greeting_id, post_closing_en, post_closing_id, ordering_open)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    s.whatsappNumber ?? null,
    s.postGreeting.en,
    s.postGreeting.id,
    s.postClosing.en,
    s.postClosing.id,
    s.orderingOpen,
  );
}

export function weekStatements(db: Db, sellerId: string, week: Week): Array<D1Statement> {
  return [
    db.stmt(
      `INSERT INTO weeks (seller_id, cooking_date, cutoff_at, status, delivery_available, delivery_note_en, delivery_note_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sellerId,
      week.cookingDate,
      week.cutoffAt,
      week.status,
      week.delivery.available,
      week.delivery.note.en,
      week.delivery.note.id,
    ),
    ...week.pickupPoints.map((point, position) => pickupStatement(db, sellerId, point, position)),
  ];
}

export function pickupStatement(
  db: Db,
  sellerId: string,
  point: Week['pickupPoints'][number],
  position: number,
): D1Statement {
  return db.stmt(
    `INSERT INTO pickup_points (seller_id, id, position, place, directions_en, directions_id, window_start, window_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    point.id,
    position,
    point.place,
    point.directions.en,
    point.directions.id,
    point.window.start,
    point.window.end,
  );
}

export function chefStatement(db: Db, chef: Chef, position: number): D1Statement {
  return db.stmt(
    'INSERT INTO chefs (seller_id, id, name, position) VALUES (?, ?, ?, ?)',
    chef.sellerId,
    chef.id,
    chef.name,
    position,
  );
}

export function itemStatement(
  db: Db,
  sellerId: string,
  item: MenuItem,
  position: number,
): D1Statement {
  return db.stmt(
    `INSERT INTO menu_items (seller_id, id, position, name_en, name_id, description_en, description_id, size_en, size_id,
       price_cents, portion_limit, chef_id, sold_out)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    item.id,
    position,
    item.name.en,
    item.name.id,
    item.description.en,
    item.description.id,
    item.size.en,
    item.size.id,
    item.priceCents,
    item.limit ?? null,
    item.chefId ?? null,
    item.soldOut === true,
  );
}

/** A saved set: its row, its items and its image references. */
export function setStatements(
  db: Db,
  sellerId: string,
  set: SavedSet,
  position: number,
): Array<D1Statement> {
  const statements = [
    db.stmt(
      `INSERT INTO saved_sets (seller_id, id, position, name, banner_background, image_alt_en, image_alt_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sellerId,
      set.id,
      position,
      set.name,
      set.images.bannerBackground ?? null,
      set.images.alt?.en ?? '',
      set.images.alt?.id ?? '',
    ),
    ...set.items.map((item, index) => setItemStatement(db, sellerId, set.id, item, index)),
  ];
  for (const slot of IMAGE_SLOTS) {
    const ref = set.images[slot];
    if (ref === undefined) continue;
    statements.push(
      db.stmt(
        'INSERT INTO saved_set_images (seller_id, set_id, slot, ref) VALUES (?, ?, ?, ?)',
        sellerId,
        set.id,
        slot,
        ref,
      ),
    );
  }
  return statements;
}

function setItemStatement(
  db: Db,
  sellerId: string,
  setId: string,
  item: SavedSetItem,
  position: number,
): D1Statement {
  return db.stmt(
    `INSERT INTO saved_set_items (seller_id, set_id, position, name_en, name_id, description_en, description_id,
       size_en, size_id, price_cents, portion_limit, chef_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    setId,
    position,
    item.name.en,
    item.name.id,
    item.description.en,
    item.description.id,
    item.size.en,
    item.size.id,
    item.priceCents,
    item.limit ?? null,
    item.chefId ?? null,
  );
}
