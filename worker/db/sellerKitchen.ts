// The public and seller menu reads, settings, past weeks, chefs and images (split out of seller.ts, plan 098 C3; the code is unchanged).
import type { Chef, KitchenImages, MenuItem, SellerMenuItemView } from '../../shared/domain';
import { checkImageUpload, type ImageSlot } from '../../shared/imageSlots';
import { MAX_CHEFS } from '../../shared/limits';
import type { SellerMenuResponse } from '../../shared/menuContract';
import { type PastWeek } from '../../shared/pastWeeks';
import type { ImageStyleRequest, UpdateItemRequest } from '../../shared/setupContract';
import type { SellerRepository } from '../repo/Repository';
import { sellerViews } from './menuView';
import { readOrders } from './orders';
import {
  chefOf,
  itemOf,
  settingsOf,
  type ChefRow,
  type ItemRow,
  type MenuRow,
  type SettingsRow,
} from './rows';
import { chefStatement } from './write';
import { fail, ok, without } from './sellerShared';
import { type SellerContext } from './sellerContext';

/** The public and seller menu reads, settings, past weeks, chefs and images. */
export function kitchenPart(
  c: SellerContext,
): Pick<
  SellerRepository,
  | 'getMenu'
  | 'getSellerMenu'
  | 'getSettings'
  | 'setSettings'
  | 'listPastWeeks'
  | 'getPastWeek'
  | 'patchItem'
  | 'setKitchenName'
  | 'listChefs'
  | 'addChef'
  | 'renameChef'
  | 'removeChef'
  | 'getImages'
  | 'setImage'
  | 'removeImage'
  | 'setImageStyle'
> {
  const {
    deps,
    db,
    sid,
    usedStatement,
    loadState,
    readImages,
    imageStatements,
    publicMenu,
    readPastWeeks,
  } = c;
  return {
    async getMenu() {
      return publicMenu(await loadState());
    },

    async getSellerMenu(): Promise<SellerMenuResponse> {
      const s = await loadState();
      const menu = publicMenu(s, true);
      return { ...menu, chefs: s.chefs, items: sellerViews(s.items, s.used) };
    },

    async getSettings() {
      const [settings, menus] = await db.reads([
        db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
        db.stmt('SELECT taking_orders FROM menus WHERE seller_id = ?', sid),
      ]);
      const taking = (menus[0] as Pick<MenuRow, 'taking_orders'>).taking_orders === 1;
      return settingsOf(settings[0] as SettingsRow, taking);
    },

    /**
     * Replaces the settings; the caller has already validated and normalised them. The theme and
     * menu defaults are kept as they are; "ordering open" is the menu's taking-orders switch.
     */
    async setSettings(next) {
      await db.batch([
        db.stmt(
          `UPDATE kitchen_settings SET whatsapp_number = ?, post_greeting_en = ?, post_greeting_id = ?,
             post_closing_en = ?, post_closing_id = ?, languages = COALESCE(?, languages),
             first_language = CASE WHEN ? THEN ? ELSE first_language END WHERE seller_id = ?`,
          next.whatsappNumber ?? null,
          next.postGreeting.en,
          next.postGreeting.id,
          next.postClosing.en,
          next.postClosing.id,
          next.languages ?? null,
          next.firstLanguage === undefined ? 0 : 1,
          next.firstLanguage ?? null,
          sid,
        ),
        db.stmt('UPDATE menus SET taking_orders = ? WHERE seller_id = ?', next.orderingOpen, sid),
      ]);
      const kept = await this.getSettings();
      const rest = structuredClone(next);
      delete rest.firstLanguage;
      return {
        ...rest,
        languages: next.languages ?? kept.languages,
        ...(kept.firstLanguage ? { firstLanguage: kept.firstLanguage } : {}),
      };
    },

    listPastWeeks: readPastWeeks,

    async getPastWeek(id: string): Promise<PastWeek | undefined> {
      const found = (await readPastWeeks()).find((candidate) => candidate.id === id);
      if (!found) return undefined;
      const { hasOrders, ...rest } = found;
      if (!hasOrders) return rest;
      return { ...rest, orders: await readOrders(db, sid, 'o.past_week_id = ?', id) };
    },

    async patchItem(id: string, patch: UpdateItemRequest) {
      const [rows, chefs, used] = await db.reads([
        db.stmt('SELECT * FROM menu_items WHERE seller_id = ? AND id = ?', sid, id),
        db.stmt(
          'SELECT id FROM chefs WHERE seller_id = ? AND id = ?',
          sid,
          typeof patch.chefId === 'string' ? patch.chefId : '',
        ),
        usedStatement(),
      ]);
      const row = rows[0] as ItemRow | undefined;
      if (!row) return fail('not_found', 'Item not found');
      if (typeof patch.chefId === 'string' && chefs.length === 0) {
        return fail('unknown_chef', 'Unknown chef');
      }
      // Plan 111: a choice only has Sold out and a limit; the rest belongs to its dish.
      if (
        row.group_id !== null &&
        Object.keys(patch).some((key) => key !== 'soldOut' && key !== 'limit')
      ) {
        return fail('invalid_request', 'A choice only has a limit and Sold out');
      }
      const next: MenuItem = { ...itemOf(row) };
      if (patch.name) next.name = { ...patch.name };
      if (patch.description) next.description = { ...patch.description };
      if (patch.size) next.size = { ...patch.size };
      if (patch.priceCents !== undefined) next.priceCents = patch.priceCents;
      if (patch.limit === null) delete next.limit;
      else if (patch.limit !== undefined) next.limit = patch.limit;
      if (patch.chefId === null) delete next.chefId;
      else if (patch.chefId !== undefined) next.chefId = patch.chefId;
      if (patch.soldOut === false) delete next.soldOut;
      else if (patch.soldOut === true) next.soldOut = true;
      if (patch.preorder === true) delete next.preorder;
      else if (patch.preorder === false) next.preorder = false;
      if (patch.dayStock === null) delete next.dayStock;
      else if (patch.dayStock !== undefined) next.dayStock = patch.dayStock;
      if (next.preorder === false && next.dayStock === undefined) {
        return fail('invalid_request', 'On the day only needs a day stock');
      }
      await db.batch([
        db.stmt(
          `UPDATE menu_items SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
             price_cents = ?, portion_limit = ?, chef_id = ?, sold_out = ?, preorder = ?, day_stock = ?
             WHERE seller_id = ? AND id = ?`,
          next.name.en,
          next.name.id,
          next.description.en,
          next.description.id,
          next.size.en,
          next.size.id,
          next.priceCents,
          next.limit ?? null,
          next.chefId ?? null,
          next.soldOut === true,
          next.preorder !== false,
          next.dayStock ?? null,
          sid,
          id,
        ),
        // The choices of a dish follow it (plan 111).
        db.stmt(
          `UPDATE menu_items SET description_en = ?, description_id = ?, size_en = ?, size_id = ?,
             price_cents = ?, chef_id = ?, preorder = ?, day_stock = ?
             WHERE seller_id = ? AND group_id = ?`,
          next.description.en,
          next.description.id,
          next.size.en,
          next.size.id,
          next.priceCents,
          next.chefId ?? null,
          next.preorder !== false,
          next.dayStock ?? null,
          sid,
          id,
        ),
      ]);
      const usedMap = new Map(
        (used as Array<{ item_id: string; used: number }>).map((r) => [r.item_id, r.used]),
      );
      const all = await db.all<ItemRow>(
        'SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position',
        sid,
      );
      const view = sellerViews(all.map(itemOf), usedMap).find((candidate) => candidate.id === id);
      return ok(view as SellerMenuItemView);
    },

    async setKitchenName(name: string) {
      await db.batch([
        db.stmt('UPDATE sellers SET name = ? WHERE id = ?', name, sid),
        db.stmt('UPDATE kitchens SET name = ? WHERE seller_id = ?', name, sid),
      ]);
      return name;
    },

    // ---- Chefs ----

    async listChefs() {
      const rows = await db.all<ChefRow>(
        'SELECT id, name FROM chefs WHERE seller_id = ? ORDER BY position',
        sid,
      );
      return rows.map((row) => chefOf(sid, row));
    },

    async addChef(name: string) {
      const row = await db.first<{ n: number; top: number }>(
        'SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS top FROM chefs WHERE seller_id = ?',
        sid,
      );
      if ((row?.n ?? 0) >= MAX_CHEFS) return fail('limit_reached', 'Too many chefs');
      const chef: Chef = { id: deps.newId(), sellerId: sid, name };
      await chefStatement(db, chef, (row?.top ?? -1) + 1).run();
      return ok({ ...chef });
    },

    async renameChef(id: string, name: string) {
      const found = await db.first(
        'SELECT 1 AS hit FROM chefs WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Chef not found');
      await db
        .stmt('UPDATE chefs SET name = ? WHERE seller_id = ? AND id = ?', name, sid, id)
        .run();
      return ok({ id, sellerId: sid, name });
    },

    /** Deleting a chef unassigns their items (this week and in saved sets). */
    async removeChef(id: string) {
      const found = await db.first(
        'SELECT 1 AS hit FROM chefs WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Chef not found');
      await db.batch([
        db.stmt(
          'UPDATE menu_items SET chef_id = NULL WHERE seller_id = ? AND chef_id = ?',
          sid,
          id,
        ),
        // Dishes that were the chef's go back to the whole kitchen.
        db.stmt('UPDATE dishes SET chef_id = NULL WHERE seller_id = ? AND chef_id = ?', sid, id),
        db.stmt('DELETE FROM chefs WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok(true as const);
    },

    // ---- Images (D-038, D-040) ----

    getImages: readImages,

    async setImage(slot: ImageSlot, dataUrl: unknown, ref?: string) {
      const check = checkImageUpload(slot, dataUrl);
      if (!check.ok) {
        const message = {
          image_type: 'Use a jpeg, png or webp image',
          image_too_big: 'The image is over 600 KB',
          image_ratio: 'The image has the wrong shape for this place',
        }[check.error];
        return fail(check.error, message);
      }
      const next = { ...(await readImages()), [slot]: ref ?? (dataUrl as string) };
      await db.batch(imageStatements(next));
      return ok(next);
    },

    async removeImage(slot: ImageSlot) {
      const next = without(await readImages(), slot);
      await db.batch(imageStatements(next));
      return next;
    },

    /** Banner colour and alt text. */
    async setImageStyle(style: ImageStyleRequest) {
      const current = await readImages();
      const slots = without(without(current, 'bannerBackground'), 'alt');
      const colour =
        style.bannerBackground === undefined ? current.bannerBackground : style.bannerBackground;
      const alt = style.alt === undefined ? current.alt : style.alt;
      const hasAlt = alt !== undefined && (alt.en !== '' || alt.id !== '');
      const next: KitchenImages = {
        ...slots,
        ...(colour ? { bannerBackground: colour } : {}),
        ...(hasAlt ? { alt } : {}),
      };
      await db.batch(imageStatements(next));
      return next;
    },
  };
}
