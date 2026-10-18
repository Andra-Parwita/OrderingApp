// Backup, restore and the orders CSV (split out of seller.ts, plan 098 C3; the code is unchanged).
import { BACKUP_VERSION, type BackupFile } from '../../shared/backup';
import { ordersToCsv } from '../../shared/csv';
import type { KitchenImages, MenuItem, SellerOrder } from '../../shared/domain';
import { IMAGE_SLOTS } from '../../shared/imageSlots';
import { type Dish, type Menu } from '../../shared/menusContract';
import { keepsOrderDetails, type PastWeek } from '../../shared/pastWeeks';
import type { SavedSet } from '../../shared/setupContract';
import { isOwnImageRef } from '../images/r2';
import type { SellerRepository } from '../repo/Repository';
import { marks, type D1Statement } from './d1';
import { insertOrderStatements, LIVE_MENU, readOrders } from './orders';
import { dropExpiredDetails } from './retention';
import {
  dishStatement,
  itemStatement,
  kitchenStatements,
  menuStatements,
  placeStatement,
  setStatements,
  settingsStatement,
  type StoredSet,
} from './write';
import { defaultPreferences, without } from './sellerShared';
import { type SellerContext } from './sellerContext';

/** Backup, restore and the orders CSV. */
export function backupPart(
  c: SellerContext,
): Pick<SellerRepository, 'exportBackup' | 'restoreBackup' | 'ordersCsv'> {
  const { deps, db, seller, sid, nowIso, menuOps, handover, loadState, readSets, readPastWeeks } =
    c;
  return {
    // ---- Backup and CSV ----

    async exportBackup(): Promise<BackupFile> {
      await dropExpiredDetails(db, deps.now(), sid);
      const [s, sets, live, past, archived, pastRows, view, places, dishes, links, prefs, log] =
        await Promise.all([
          loadState(),
          readSets(),
          readOrders(db, sid, LIVE_MENU),
          readPastWeeks(),
          readOrders(db, sid, 'o.past_week_id IS NOT NULL'),
          db.all<{ id: string; past_week_id: string }>(
            'SELECT id, past_week_id FROM orders WHERE seller_id = ? AND past_week_id IS NOT NULL',
            sid,
          ),
          menuOps.getCurrentMenu(),
          menuOps.listPickupPlaces(),
          menuOps.listDishes(),
          db.all<{ id: string; dish_id: string | null }>(
            'SELECT id, dish_id FROM menu_items WHERE seller_id = ?',
            sid,
          ),
          menuOps.getPreferences(),
          handover.listMessages(),
        ]);
      const weekOfOrder = new Map(pastRows.map((row) => [row.id, row.past_week_id]));
      const itemDishIds: Record<string, string> = {};
      for (const link of links) if (link.dish_id !== null) itemDishIds[link.id] = link.dish_id;
      return structuredClone({
        version: BACKUP_VERSION,
        exportedAt: nowIso(),
        seller: { slug: seller.slug, name: seller.name },
        kitchen: s.kitchen,
        settings: s.settings,
        week: s.week,
        items: s.items,
        chefs: s.chefs,
        sets: sets.map(({ id, name, items, images }): SavedSet => ({ id, name, items, images })),
        menu: view.menu,
        pickupPlaces: places,
        dishes,
        itemDishIds,
        dishSets: sets.map(({ id, name, dishIds, timesUsed }) => ({
          id,
          name,
          dishIds,
          timesUsed,
        })),
        preferences: prefs,
        ...(log.length > 0 ? { messageLog: log } : {}),
        orders: live,
        pastWeeks: past.map(({ hasOrders, ...rest }): PastWeek => {
          if (!hasOrders) return rest;
          return {
            ...rest,
            orders: archived.filter((order) => weekOfOrder.get(order.id) === rest.id),
          };
        }),
      });
    },

    /** Replaces this seller's data with an already validated backup; other sellers are not touched. */
    async restoreBackup(file: BackupFile): Promise<number> {
      const copy = structuredClone(file);
      // Image refs in the file are client-supplied: only this seller's own (or static samples) get
      // in; a foreign, external or malformed ref leaves its slot empty and is counted.
      let droppedImages = 0;
      const cleanImages = (images: KitchenImages | undefined): void => {
        if (!images) return;
        for (const slot of IMAGE_SLOTS) {
          const ref = images[slot];
          if (ref === undefined) continue;
          if (ref === '' || !isOwnImageRef(ref, sid)) {
            delete images[slot];
            droppedImages += 1;
          }
        }
      };
      cleanImages(copy.kitchen.images);
      for (const set of copy.sets) cleanImages(set.images);
      if (
        copy.kitchen.bannerImageUrl !== undefined &&
        !isOwnImageRef(copy.kitchen.bannerImageUrl, sid)
      ) {
        delete copy.kitchen.bannerImageUrl;
        droppedImages += 1;
      }
      if (copy.menu?.pictureRef !== undefined && !isOwnImageRef(copy.menu.pictureRef, sid)) {
        delete copy.menu.pictureRef;
        droppedImages += 1;
      }
      // Plan 067: dish pictures too (the library's and the menu copies').
      for (const entry of [...copy.items, ...(copy.dishes ?? [])]) {
        if (entry.pictureRef !== undefined && !isOwnImageRef(entry.pictureRef, sid)) {
          delete entry.pictureRef;
          droppedImages += 1;
        }
      }
      const at = nowIso();
      const chefs = copy.chefs.map((chef) => ({ ...chef, sellerId: sid }));
      const known = new Set(chefs.map((chef) => chef.id));
      const fixChef = <T extends { chefId?: string }>(item: T): T =>
        item.chefId === undefined || known.has(item.chefId) ? item : (without(item, 'chefId') as T);
      const items = copy.items.map(fixChef);

      // The stage 3 records come from the file; a file made before them is rebuilt: every menu
      // item and every item of a set becomes a library dish, and the week becomes the menu.
      const dishes: Array<Dish> = [];
      let itemDishIds: Record<string, string> = {};
      let storedSets: Array<StoredSet>;
      if (copy.dishes) {
        dishes.push(...copy.dishes.map(fixChef));
        itemDishIds = copy.itemDishIds ?? {};
        const byId = new Map((copy.dishSets ?? []).map((set) => [set.id, set]));
        storedSets = copy.sets.map((set) => ({
          id: set.id,
          name: set.name,
          dishIds: byId.get(set.id)?.dishIds ?? [],
          timesUsed: byId.get(set.id)?.timesUsed ?? 0,
          images: set.images,
        }));
      } else {
        const asDish = (item: Omit<MenuItem, 'id'>, id: string): Dish => ({
          id,
          name: item.name,
          description: item.description,
          size: item.size,
          priceCents: item.priceCents,
          ...(item.limit !== undefined ? { limit: item.limit } : {}),
          ...(item.chefId !== undefined ? { chefId: item.chefId } : {}),
          ...(item.preorder === false ? { preorder: false } : {}),
          ...(item.dayStock !== undefined ? { dayStock: item.dayStock } : {}),
        });
        for (const item of items) {
          dishes.push(asDish(item, item.id));
          itemDishIds[item.id] = item.id;
        }
        storedSets = copy.sets.map((set) => ({
          id: set.id,
          name: set.name,
          dishIds: set.items.map((item) => {
            const dish = asDish(fixChef(item), deps.newId());
            dishes.push(dish);
            return dish.id;
          }),
          timesUsed: 0,
          images: set.images,
        }));
      }
      const pickupPlaces = copy.pickupPlaces ?? copy.week.pickupPoints;
      const menu: Menu = copy.menu ?? {
        id: deps.newId(),
        state: copy.week.status === 'published' ? 'live' : 'not_published',
        cookingDate: copy.week.cookingDate,
        cutoffAt: copy.week.cutoffAt,
        delivery: copy.week.delivery,
        wizardStep: copy.week.status === 'published' ? 3 : 0,
        takingOrders: copy.settings.orderingOpen,
        placeUses: copy.week.pickupPoints.map((point) => ({ placeId: point.id })),
      };
      const forMe = (order: SellerOrder): SellerOrder => ({ ...order, sellerId: sid });
      const own = (table: string) => db.stmt(`DELETE FROM ${table} WHERE seller_id = ?`, sid);
      const ownMenu = (table: string, column: string) =>
        db.stmt(
          `DELETE FROM ${table} WHERE seller_id = ? AND ${column} IN (SELECT id FROM orders WHERE seller_id = ? AND kind = 'menu')`,
          sid,
          sid,
        );
      const chefList = [...known];

      const statements: Array<D1Statement> = [
        // Everything this seller has, children before parents. Chefs that stay keep their account.
        own('message_log'),
        // Plan 081: private orders are not in a backup, so a restore leaves them (and their lines,
        // audit and inbox) alone.
        ownMenu('order_audit', 'order_id'),
        ownMenu('order_inbox', 'order_id'),
        ownMenu('order_lines', 'order_id'),
        db.stmt("DELETE FROM orders WHERE seller_id = ? AND kind = 'menu'", sid),
        own('expired_orders'),
        own('past_week_items'),
        own('past_weeks'),
        own('saved_set_images'),
        own('saved_set_dishes'),
        own('saved_sets'),
        own('menu_items'),
        own('menu_pickup_places'),
        own('pickup_places'),
        own('menus'),
        own('dishes'),
        own('kitchen_images'),
        own('kitchens'),
        own('kitchen_settings'),
        chefList.length === 0
          ? own('chefs')
          : db.stmt(
              `DELETE FROM chefs WHERE seller_id = ? AND id NOT IN (${marks(chefList.length)})`,
              sid,
              ...chefList,
            ),
      ];
      chefs.forEach((chef, position) => {
        statements.push(
          db.stmt(
            `INSERT INTO chefs (seller_id, id, name, position) VALUES (?, ?, ?, ?)
             ON CONFLICT (seller_id, id) DO UPDATE SET name = excluded.name, position = excluded.position`,
            sid,
            chef.id,
            chef.name,
            position,
          ),
        );
      });
      statements.push(
        ...kitchenStatements(db, { ...copy.kitchen, sellerId: sid, name: copy.kitchen.name }, at),
        settingsStatement(db, sid, copy.settings, copy.preferences ?? defaultPreferences),
        ...pickupPlaces.map((place, position) => placeStatement(db, sid, place, position)),
        ...menuStatements(db, sid, menu),
        ...dishes.map((dish) => dishStatement(db, sid, dish, at)),
        ...items.map((item, position) =>
          itemStatement(db, sid, item, position, itemDishIds[item.id]),
        ),
        ...storedSets.flatMap((set, position) => setStatements(db, sid, set, position)),
        // The log belongs to the file's menu: entries of another menu id are not kept.
        ...(copy.messageLog ?? [])
          .filter((entry) => entry.menuId === menu.id)
          .map((entry) =>
            db.stmt(
              `INSERT INTO message_log (seller_id, id, menu_id, group_key, type, minutes, text_en, text_id, at, sent_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              sid,
              entry.id,
              entry.menuId,
              entry.group,
              entry.type,
              entry.minutes ?? null,
              entry.text?.en ?? null,
              entry.text?.id ?? null,
              entry.at,
              entry.sentCount,
            ),
          ),
      );
      // Newest closed week is first in the file; rows are listed newest-inserted first, so the
      // oldest goes in first.
      for (const past of [...copy.pastWeeks].reverse()) {
        const kept = past.orders !== undefined && keepsOrderDetails(past.cookingDate, deps.now());
        statements.push(
          db.stmt(
            `INSERT INTO past_weeks (seller_id, id, cooking_date, closed_at, orders_count, cancelled_count, income_cents,
               paid_cents, unpaid_cents, details_dropped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sid,
            past.id,
            past.cookingDate,
            past.closedAt,
            past.totals.orders,
            past.totals.cancelled,
            past.totals.incomeCents,
            past.totals.paidCents,
            past.totals.unpaidCents,
            kept ? null : at,
          ),
          ...past.totals.items.map((item, position) =>
            db.stmt(
              `INSERT INTO past_week_items (seller_id, past_week_id, position, item_id, name_en, name_id, qty)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              sid,
              past.id,
              position,
              item.itemId,
              item.name.en,
              item.name.id,
              item.qty,
            ),
          ),
        );
        for (const order of past.orders ?? []) {
          if (kept) statements.push(...insertOrderStatements(db, forMe(order), past.id));
          else {
            statements.push(
              db.stmt(
                'INSERT OR IGNORE INTO expired_orders (token, seller_id, cooking_date) VALUES (?, ?, ?)',
                order.token,
                sid,
                past.cookingDate,
              ),
            );
          }
        }
      }
      for (const order of copy.orders) {
        statements.push(...insertOrderStatements(db, forMe(order), null));
      }
      await db.batch(statements);
      return droppedImages;
    },

    /** Every live order, oldest first, as CSV with a BOM for Excel. */
    async ordersCsv() {
      return ordersToCsv(await readOrders(db, sid, LIVE_MENU));
    },
  };
}
