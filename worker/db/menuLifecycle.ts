// The menu and its picture, publishing and finishing (split out of menus.ts, plan 098 C3; the code is unchanged).
import { comingSaturday, cutoffAtFor } from '../../shared/dates';
import { type FinishMenuResponse } from '../../shared/menusContract';
import type { ApiWarning } from '../../shared/apiError';
import { checkImageUpload } from '../../shared/imageSlots';
import type { SellerRepository } from '../repo/Repository';
import { marks, type D1Statement } from './d1';
import { LIVE_MENU } from './orders';
import { preferencesOf, type DishRow, type ItemRow, type MenuRow, type SettingsRow } from './rows';
import { menuStatements } from './write';
import { fail, ok, type MenuContext } from './menuContext';
import { finishMenu } from './menuFinish';

/** The menu and its picture, publishing and finishing. */
export function lifecyclePart(
  c: MenuContext,
): Pick<
  SellerRepository,
  | 'getCurrentMenu'
  | 'createMenu'
  | 'updateMenu'
  | 'publishMenu'
  | 'unpublishMenu'
  | 'deleteMenu'
  | 'setMenuPicture'
  | 'removeMenuPicture'
  | 'usePastMenuPicture'
  | 'finishMenuNow'
> {
  const { deps, db, sid, nowIso, zoneOf, readView, menuRow, copyStatements } = c;
  return {
    // ---- The menu ----

    getCurrentMenu: readView,

    async createMenu(request) {
      const [menus, uses, settings] = await db.reads([
        db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
        db.stmt(
          'SELECT place_id FROM menu_pickup_places WHERE seller_id = ? ORDER BY position',
          sid,
        ),
        db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
      ]);
      const current = menus[0] as MenuRow | undefined;
      if (current && current.state !== 'finished') {
        return fail('menu_in_progress', 'Finish the current menu before making a new one');
      }
      const defaults = preferencesOf(settings[0] as SettingsRow).menuDefaults;
      const zone = await zoneOf();
      const cookingDate = request.cookingDate ?? comingSaturday(deps.now(), zone);
      // Plan 064: "start from a past menu" brings its picture along (the same file, no new upload).
      const fromPast = request.pictureFromPastMenu;
      const pastPicture =
        fromPast === undefined
          ? null
          : ((
              await db.first<{ picture_ref: string | null }>(
                'SELECT picture_ref FROM past_weeks WHERE seller_id = ? AND id = ?',
                sid,
                fromPast,
              )
            )?.picture_ref ?? null);
      await db.batch([
        db.stmt('DELETE FROM menu_items WHERE seller_id = ?', sid),
        db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', sid),
        db.stmt('DELETE FROM menus WHERE seller_id = ?', sid),
        ...menuStatements(db, sid, {
          id: deps.newId(),
          state: 'not_published',
          cookingDate,
          cutoffAt: cutoffAtFor(cookingDate, defaults.cutoffDaysBefore, defaults.cutoffTime, zone),
          delivery: defaults.delivery,
          wizardStep: 0,
          takingOrders: true,
          ...(pastPicture !== null ? { pictureRef: pastPicture } : {}),
          // The new menu starts with the places the last one used, at their usual times.
          placeUses: (uses as Array<{ place_id: string }>).map((use) => ({
            placeId: use.place_id,
          })),
        }),
      ]);
      return ok(await readView());
    },

    async updateMenu(request) {
      const [menus, settings, placeRows, itemRows] = await db.reads([
        db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
        db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
        db.stmt('SELECT id FROM pickup_places WHERE seller_id = ?', sid),
        db.stmt('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      ]);
      const row = menus[0] as MenuRow;
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const known = new Set((placeRows as Array<{ id: string }>).map((place) => place.id));
      if (request.places?.some((use) => !known.has(use.placeId))) {
        return fail('not_found', 'Unknown pickup place');
      }
      const defaults = preferencesOf(settings[0] as SettingsRow).menuDefaults;
      const cookingDate = request.cookingDate ?? row.cooking_date;
      // A new cooking day without a new cut-off gets the usual cut-off for that day.
      const cutoffAt =
        request.cutoffAt ??
        (cookingDate === row.cooking_date
          ? row.cutoff_at
          : cutoffAtFor(
              cookingDate,
              defaults.cutoffDaysBefore,
              defaults.cutoffTime,
              await zoneOf(),
            ));
      const statements: Array<D1Statement> = [
        db.stmt(
          `UPDATE menus SET cooking_date = ?, cutoff_at = ?, delivery_available = ?, delivery_note_en = ?,
             delivery_note_id = ?, wizard_step = ?, taking_orders = ? WHERE seller_id = ?`,
          cookingDate,
          cutoffAt,
          request.delivery?.available ?? row.delivery_available === 1,
          request.delivery?.note.en ?? row.delivery_note_en,
          request.delivery?.note.id ?? row.delivery_note_id,
          Math.max(row.wizard_step, request.wizardStep ?? 0),
          request.takingOrders ?? row.taking_orders === 1,
          sid,
        ),
      ];
      if (request.places) {
        statements.push(
          db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', sid),
          ...request.places.map((use, position) =>
            db.stmt(
              'INSERT INTO menu_pickup_places (seller_id, place_id, position, window_start, window_end) VALUES (?, ?, ?, ?, ?)',
              sid,
              use.placeId,
              position,
              use.window?.start ?? null,
              use.window?.end ?? null,
            ),
          ),
        );
      }
      let removed: Array<string> = [];
      if (request.dishIds) {
        const wanted = request.dishIds;
        const dishes =
          wanted.length === 0
            ? []
            : await db.all<DishRow>(
                `SELECT * FROM dishes WHERE seller_id = ? AND id IN (${marks(wanted.length)})`,
                sid,
                ...wanted,
              );
        const byId = new Map(dishes.map((dish) => [dish.id, dish]));
        if (wanted.some((id) => !byId.has(id))) return fail('unknown_item', 'Unknown dish');
        const items = itemRows as Array<ItemRow>;
        const kept = new Map(
          items.filter((item) => item.dish_id !== null).map((item) => [item.dish_id, item]),
        );
        removed = items
          .filter((item) => item.dish_id === null || !wanted.includes(item.dish_id))
          .map((item) => item.id);
        if (removed.length > 0) {
          statements.push(
            db.stmt(
              `DELETE FROM menu_items WHERE seller_id = ? AND id IN (${marks(removed.length)})`,
              sid,
              ...removed,
            ),
          );
        }
        const added: Array<DishRow> = [];
        wanted.forEach((dishId, position) => {
          const have = kept.get(dishId);
          if (have) {
            statements.push(
              db.stmt(
                'UPDATE menu_items SET position = ? WHERE seller_id = ? AND id = ?',
                position,
                sid,
                have.id,
              ),
            );
          } else added.push(byId.get(dishId) as DishRow);
        });
        // New copies go after the kept ones, in the order asked for.
        const positions = new Map(wanted.map((id, index) => [id, index]));
        statements.push(
          ...added.flatMap((dish) =>
            copyStatements([dish], positions.get(dish.id) ?? wanted.length),
          ),
        );
      }
      await db.batch(statements);
      // Dropping a dish that has orders is allowed (D-062); the screen is told which ones.
      const withOrders =
        removed.length === 0
          ? []
          : await db.all<{ item_id: string }>(
              `SELECT DISTINCT l.item_id AS item_id FROM order_lines l
               JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
               WHERE o.seller_id = ? AND ${LIVE_MENU} AND o.status <> 'cancelled'
                 AND l.item_id IN (${marks(removed.length)})`,
              sid,
              ...removed,
            );
      return ok({
        menu: await readView(),
        warnings: { removedWithOrders: withOrders.map((hit) => hit.item_id) },
      });
    },

    async publishMenu(force = false, takingOrders?: boolean) {
      const [row, count] = await Promise.all([
        menuRow(),
        db.first<{ n: number }>('SELECT COUNT(*) AS n FROM menu_items WHERE seller_id = ?', sid),
      ]);
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      // D-062: an empty menu is a warning the seller may override, not a block.
      if ((count?.n ?? 0) === 0 && !force && row.state === 'not_published') {
        const warning: ApiWarning = { code: 'no_dishes' };
        return { ok: false, error: 'no_items', message: 'This menu has no dishes yet', warning };
      }
      if (row.state === 'not_published') {
        await db
          .stmt(
            "UPDATE menus SET state = 'live', published_at = ?, wizard_step = 3, taking_orders = ? WHERE seller_id = ?",
            nowIso(),
            // Only a not-published menu is changed; `undefined` keeps the switch as it is.
            takingOrders === undefined ? row.taking_orders : takingOrders ? 1 : 0,
            sid,
          )
          .run();
      }
      return ok(await readView());
    },

    /** Live back to not published; the orders already placed stay (D-062: the screen warns first). */
    async unpublishMenu() {
      const row = await menuRow();
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      if (row.state === 'live') {
        await db.stmt("UPDATE menus SET state = 'not_published' WHERE seller_id = ?", sid).run();
      }
      return ok(await readView());
    },

    /**
     * Throws away a menu that is not published yet (the screen warns first): its dishes and places go
     * and it counts as finished, so the seller is at 'no active menu' and may start a new one. It
     * leaves nothing in Past menus.
     */
    async deleteMenu() {
      const row = await menuRow();
      if (row.state !== 'not_published') {
        return fail('week_not_draft', 'Only a menu that is not published can be deleted');
      }
      await db.batch([
        db.stmt('DELETE FROM menu_items WHERE seller_id = ?', sid),
        db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ?', sid),
        db.stmt(
          "UPDATE menus SET state = 'finished', finished_at = ?, picture_ref = NULL WHERE seller_id = ?",
          nowIso(),
          sid,
        ),
      ]);
      return ok({ view: await readView(), before: row.picture_ref ?? undefined });
    },

    /** The menu picture (3:2, D-060): `ref` is the R2 path; without a bucket the data URL itself is kept. */
    async setMenuPicture(dataUrl, ref) {
      const row = await menuRow();
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const check = checkImageUpload('menuPicture', dataUrl);
      if (!check.ok) {
        const message = {
          image_type: 'Use a jpeg, png or webp image',
          image_too_big: 'The image is over 600 KB',
          image_ratio: 'The image has the wrong shape for this place',
        }[check.error];
        return fail(check.error, message);
      }
      await db
        .stmt(
          'UPDATE menus SET picture_ref = ? WHERE seller_id = ?',
          ref ?? (dataUrl as string),
          sid,
        )
        .run();
      return ok({ view: await readView(), before: row.picture_ref ?? undefined });
    },

    async removeMenuPicture() {
      const row = await menuRow();
      await db.stmt('UPDATE menus SET picture_ref = NULL WHERE seller_id = ?', sid).run();
      return { view: await readView(), before: row.picture_ref ?? undefined };
    },

    /** Plan 064: the current menu takes the picture a past menu kept (the same file, no upload). */
    async usePastMenuPicture(pastMenuId) {
      const row = await menuRow();
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const past = await db.first<{ picture_ref: string | null }>(
        'SELECT picture_ref FROM past_weeks WHERE seller_id = ? AND id = ?',
        sid,
        pastMenuId,
      );
      if (!past?.picture_ref) return fail('not_found', 'That past menu has no picture');
      await db
        .stmt('UPDATE menus SET picture_ref = ? WHERE seller_id = ?', past.picture_ref, sid)
        .run();
      return ok({ view: await readView(), before: row.picture_ref ?? undefined });
    },

    async finishMenuNow() {
      const row = await menuRow();
      if (row.state !== 'live') return fail('menu_not_live', 'Only a live menu can be finished');
      const done = await finishMenu(db, sid, deps.now(), row);
      return ok({
        menu: await readView(),
        closedOrders: done.closedOrders,
        prunedPictures: done.prunedPictures,
      } satisfies FinishMenuResponse & { prunedPictures: Array<string> });
    },
  };
}
