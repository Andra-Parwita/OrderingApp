// INSERT statements for a seller's configuration rows (kitchen, settings, menu, pickup places, chefs,
// dishes, menu items, saved sets). Shared by seeding, adding a seller and restoring a backup.
import type { Chef, Kitchen, KitchenSettings, MenuItem, PickupPoint } from '../../shared/domain';
import { IMAGE_SLOTS } from '../../shared/imageSlots';
import {
  DEFAULT_MENU_DEFAULTS,
  DEFAULT_THEME,
  type Dish,
  type Menu,
  type Preferences,
} from '../../shared/menusContract';
import type { KitchenImages } from '../../shared/domain';
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

/** The settings row. "Taking orders" is the menu's now (`s.orderingOpen` is not written here). */
export function settingsStatement(
  db: Db,
  sellerId: string,
  s: KitchenSettings,
  prefs: Preferences = { theme: DEFAULT_THEME, menuDefaults: DEFAULT_MENU_DEFAULTS },
): D1Statement {
  const d = prefs.menuDefaults;
  return db.stmt(
    `INSERT INTO kitchen_settings (seller_id, whatsapp_number, post_greeting_en, post_greeting_id, post_closing_en, post_closing_id,
       theme, default_cutoff_days, default_cutoff_time, default_delivery, default_delivery_note_en, default_delivery_note_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    s.whatsappNumber ?? null,
    s.postGreeting.en,
    s.postGreeting.id,
    s.postClosing.en,
    s.postClosing.id,
    prefs.theme,
    d.cutoffDaysBefore,
    d.cutoffTime,
    d.delivery.available,
    d.delivery.note.en,
    d.delivery.note.id,
  );
}

/** The menu row and the places it uses (their `pickup_places` rows must already exist). */
export function menuStatements(db: Db, sellerId: string, menu: Menu): Array<D1Statement> {
  return [
    db.stmt(
      `INSERT INTO menus (seller_id, id, state, cooking_date, cutoff_at, delivery_available, delivery_note_en, delivery_note_id,
         picture_ref, wizard_step, taking_orders, published_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sellerId,
      menu.id,
      menu.state,
      menu.cookingDate,
      menu.cutoffAt,
      menu.delivery.available,
      menu.delivery.note.en,
      menu.delivery.note.id,
      menu.pictureRef ?? null,
      menu.wizardStep,
      menu.takingOrders,
      menu.publishedAt ?? null,
      menu.finishedAt ?? null,
    ),
    ...menu.placeUses.map((use, position) =>
      db.stmt(
        'INSERT INTO menu_pickup_places (seller_id, place_id, position, window_start, window_end) VALUES (?, ?, ?, ?, ?)',
        sellerId,
        use.placeId,
        position,
        use.window?.start ?? null,
        use.window?.end ?? null,
      ),
    ),
  ];
}

export function placeStatement(
  db: Db,
  sellerId: string,
  place: PickupPoint,
  position: number,
): D1Statement {
  return db.stmt(
    `INSERT INTO pickup_places (seller_id, id, position, place, directions_en, directions_id, window_start, window_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    place.id,
    position,
    place.place,
    place.directions.en,
    place.directions.id,
    place.window.start,
    place.window.end,
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

/** A library dish. `createdAt` is when it was first saved. */
export function dishStatement(
  db: Db,
  sellerId: string,
  dish: Dish,
  createdAt: string,
): D1Statement {
  return db.stmt(
    `INSERT INTO dishes (seller_id, id, name_en, name_id, description_en, description_id, size_en, size_id,
       price_cents, portion_limit, chef_id, last_used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sellerId,
    dish.id,
    dish.name.en,
    dish.name.id,
    dish.description.en,
    dish.description.id,
    dish.size.en,
    dish.size.id,
    dish.priceCents,
    dish.limit ?? null,
    dish.chefId ?? null,
    dish.lastUsedAt ?? null,
    createdAt,
  );
}

/** A menu dish (a row of menu_items); `dishId` is the library dish it is a copy of. */
export function itemStatement(
  db: Db,
  sellerId: string,
  item: MenuItem,
  position: number,
  dishId?: string,
): D1Statement {
  return db.stmt(
    `INSERT INTO menu_items (seller_id, id, position, name_en, name_id, description_en, description_id, size_en, size_id,
       price_cents, portion_limit, chef_id, sold_out, dish_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    dishId ?? null,
  );
}

/** What a stored saved set is: its dishes, how often it was used, and the legacy image references. */
export type StoredSet = {
  id: string;
  name: string;
  dishIds: ReadonlyArray<string>;
  timesUsed: number;
  images: KitchenImages;
};

/** A saved set: its row, its dishes and its image references (dishes must already exist). */
export function setStatements(
  db: Db,
  sellerId: string,
  set: StoredSet,
  position: number,
): Array<D1Statement> {
  const statements = [
    db.stmt(
      `INSERT INTO saved_sets (seller_id, id, position, name, times_used, banner_background, image_alt_en, image_alt_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      sellerId,
      set.id,
      position,
      set.name,
      set.timesUsed,
      set.images.bannerBackground ?? null,
      set.images.alt?.en ?? '',
      set.images.alt?.id ?? '',
    ),
    ...set.dishIds.map((dishId, index) =>
      db.stmt(
        'INSERT INTO saved_set_dishes (seller_id, set_id, position, dish_id) VALUES (?, ?, ?, ?)',
        sellerId,
        set.id,
        index,
        dishId,
      ),
    ),
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
