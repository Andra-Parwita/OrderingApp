// Your dishes and saved sets of dishes (split out of menus.ts, plan 098 C3; the code is unchanged).
import { MAX_DISHES, MAX_DISH_PICTURES, MAX_MENU_ITEMS, MAX_SETS } from '../../shared/limits';
import {
  importRowProblem,
  type Dish,
  type ImportProblem,
  type ImportRowResult,
} from '../../shared/menusContract';
import { checkImageUpload } from '../../shared/imageSlots';
import type { SellerRepository } from '../repo/Repository';
import { marks } from './d1';
import { dishOf, type DishRow, type ItemRow, type SetDishRow, type SetRow } from './rows';
import { dishStatement, setStatements } from './write';
import { fail, ok, type MenuContext } from './menuContext';

/** Your dishes and saved sets of dishes. */
export function dishesPart(
  c: MenuContext,
): Pick<
  SellerRepository,
  | 'listDishes'
  | 'createDish'
  | 'importDishes'
  | 'updateDish'
  | 'setDishPicture'
  | 'removeDishPicture'
  | 'deleteDish'
  | 'listDishSets'
  | 'createDishSet'
  | 'addDishToMenu'
  | 'useDishSet'
> {
  const { deps, db, sid, nowIso, readView, menuRow, dishRow, chefExists, copyStatements } = c;
  return {
    // ---- Your dishes ----

    async listDishes() {
      const rows = await db.all<DishRow>(
        `SELECT * FROM dishes WHERE seller_id = ?
         ORDER BY last_used_at IS NULL, last_used_at DESC, name_en COLLATE NOCASE, id`,
        sid,
      );
      return rows.map(dishOf);
    },

    async createDish(input) {
      const count = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM dishes WHERE seller_id = ?',
        sid,
      );
      if ((count?.n ?? 0) >= MAX_DISHES) {
        return fail('limit_reached', `At most ${String(MAX_DISHES)} dishes`);
      }
      if (input.chefId !== undefined && !(await chefExists(input.chefId))) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const dish = {
        id: deps.newId(),
        name: { ...input.name },
        description: { ...(input.description ?? { en: '', id: '' }) },
        size: { ...(input.size ?? { en: '', id: '' }) },
        priceCents: input.priceCents,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.chefId !== undefined ? { chefId: input.chefId } : {}),
        ...(input.preorder === false ? { preorder: false } : {}),
        ...(input.dayStock !== undefined ? { dayStock: input.dayStock } : {}),
      };
      await dishStatement(db, sid, dish, nowIso()).run();
      return ok(dish);
    },

    async importDishes(input, asChefId) {
      const [dishes, chefs] = await Promise.all([
        db
          .all<DishRow>('SELECT * FROM dishes WHERE seller_id = ?', sid)
          .then((found) => found.map(dishOf)),
        db.all<{ id: string; name: string }>('SELECT id, name FROM chefs WHERE seller_id = ?', sid),
      ]);
      const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      const problem = (code: ImportProblem['code'], message: string): ImportProblem => ({
        code,
        message,
      });
      const myName = chefs.find((chef) => chef.id === asChefId)?.name;
      const seen = new Set<string>();
      const writes: Array<{ dish: Dish; isNew: boolean }> = [];
      const rows = input.rows.map((row): ImportRowResult => {
        const name = row.nameEn.trim() || row.nameId.trim();
        const error = (p: ImportProblem): ImportRowResult => ({
          status: 'error',
          name,
          problem: p,
        });
        const wrong = importRowProblem(row);
        if (wrong) return error(wrong);
        // A signed-in chef: only their own dishes; an empty cook means themselves (as on create).
        let chefName = row.chef.trim();
        if (asChefId !== undefined) {
          if (chefName === '') chefName = myName ?? '';
          else if (!same(chefName, myName ?? '')) {
            return error(problem('not_yours', `Only your own dishes (not ${chefName})`));
          }
        }
        const chef = chefName === '' ? undefined : chefs.find((c) => same(c.name, chefName));
        if (chefName !== '' && !chef)
          return error(problem('unknown_chef', `Unknown cook "${chefName}"`));
        const key = JSON.stringify([name.toLowerCase(), chef?.id ?? '']);
        if (seen.has(key)) {
          return error(problem('duplicate', `${name} appears twice for this cook in the file`));
        }
        seen.add(key);
        const matches = dishes.filter(
          (d) =>
            same(row.nameEn.trim() === '' ? d.name.id : d.name.en, name) &&
            (d.chefId ?? '') === (chef?.id ?? ''),
        );
        if (matches.length > 1) {
          return error(problem('ambiguous', `More than one dish called ${name} for this cook`));
        }
        const dish: Dish = {
          id: matches[0]?.id ?? deps.newId(),
          name: { en: row.nameEn.trim() || name, id: row.nameId.trim() || name },
          description: { en: row.descriptionEn.trim(), id: row.descriptionId.trim() },
          size: { en: row.size.trim(), id: row.size.trim() },
          priceCents: row.priceCents,
          ...(row.limit !== undefined ? { limit: row.limit } : {}),
          ...(chef ? { chefId: chef.id } : {}),
          ...(!row.preorder ? { preorder: false } : {}),
          ...(row.dayStock !== undefined ? { dayStock: row.dayStock } : {}),
        };
        writes.push({ dish, isNew: matches.length === 0 });
        return { status: matches.length === 0 ? 'new' : 'update', name, dishId: dish.id };
      });
      const counts = {
        new: rows.filter((r) => r.status === 'new').length,
        update: rows.filter((r) => r.status === 'update').length,
        error: rows.filter((r) => r.status === 'error').length,
      };
      const overLimit = dishes.length + counts.new > MAX_DISHES;
      if (input.apply) {
        if (overLimit) {
          return fail(
            'limit_reached',
            `At most ${String(MAX_DISHES)} dishes: you have ${String(dishes.length)} and this adds ${String(counts.new)}`,
          );
        }
        const at = nowIso();
        await db.batch(
          writes.map(({ dish, isNew }) =>
            isNew
              ? dishStatement(db, sid, dish, at)
              : db.stmt(
                  `UPDATE dishes SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
                     price_cents = ?, portion_limit = ?, chef_id = ?, preorder = ?, day_stock = ?
                   WHERE seller_id = ? AND id = ?`,
                  dish.name.en,
                  dish.name.id,
                  dish.description.en,
                  dish.description.id,
                  dish.size.en,
                  dish.size.id,
                  dish.priceCents,
                  dish.limit ?? null,
                  dish.chefId ?? null,
                  dish.preorder !== false,
                  dish.dayStock ?? null,
                  sid,
                  dish.id,
                ),
          ),
        );
      }
      return ok({ applied: input.apply, rows, counts, overLimit });
    },

    async updateDish(id, patch) {
      const row = await dishRow(id);
      if (!row) return fail('not_found', 'Dish not found');
      if (typeof patch.chefId === 'string' && !(await chefExists(patch.chefId))) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const next = dishOf(row);
      if (patch.name) next.name = { ...patch.name };
      if (patch.description) next.description = { ...patch.description };
      if (patch.size) next.size = { ...patch.size };
      if (patch.priceCents !== undefined) next.priceCents = patch.priceCents;
      if (patch.limit === null) delete next.limit;
      else if (patch.limit !== undefined) next.limit = patch.limit;
      if (patch.chefId === null) delete next.chefId;
      else if (patch.chefId !== undefined) next.chefId = patch.chefId;
      if (patch.preorder === true) delete next.preorder;
      else if (patch.preorder === false) next.preorder = false;
      if (patch.dayStock === null) delete next.dayStock;
      else if (patch.dayStock !== undefined) next.dayStock = patch.dayStock;
      if (next.preorder === false && next.dayStock === undefined) {
        return fail('invalid_request', 'On the day only needs a day stock');
      }
      await db
        .stmt(
          `UPDATE dishes SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
             price_cents = ?, portion_limit = ?, chef_id = ?, preorder = ?, day_stock = ?
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
          next.preorder !== false,
          next.dayStock ?? null,
          sid,
          id,
        )
        .run();
      return ok(next);
    },

    /** Plan 067: the dish's picture. The copies of the dish on the menu take it too. */
    async setDishPicture(id, dataUrl, ref) {
      const row = await dishRow(id);
      if (!row) return fail('not_found', 'Dish not found');
      const check = checkImageUpload('dishPicture', dataUrl);
      if (!check.ok) {
        const message = {
          image_type: 'Use a jpeg, png or webp image',
          image_too_big: 'The picture is over 200 KB',
          image_ratio: 'The picture must be square',
        }[check.error];
        return fail(check.error, message);
      }
      const others = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM dishes WHERE seller_id = ? AND picture_ref IS NOT NULL AND id <> ?',
        sid,
        id,
      );
      if ((others?.n ?? 0) >= MAX_DISH_PICTURES) {
        return fail('dish_picture_limit', `At most ${String(MAX_DISH_PICTURES)} dish pictures`);
      }
      const next = ref ?? (dataUrl as string);
      await db.batch([
        db.stmt('UPDATE dishes SET picture_ref = ? WHERE seller_id = ? AND id = ?', next, sid, id),
        db.stmt(
          'UPDATE menu_items SET picture_ref = ? WHERE seller_id = ? AND dish_id = ?',
          next,
          sid,
          id,
        ),
      ]);
      return ok({
        dish: { ...dishOf(row), pictureRef: next },
        before: row.picture_ref ?? undefined,
      });
    },

    async removeDishPicture(id) {
      const row = await dishRow(id);
      if (!row) return fail('not_found', 'Dish not found');
      await db.batch([
        db.stmt('UPDATE dishes SET picture_ref = NULL WHERE seller_id = ? AND id = ?', sid, id),
        db.stmt(
          'UPDATE menu_items SET picture_ref = NULL WHERE seller_id = ? AND dish_id = ?',
          sid,
          id,
        ),
      ]);
      const dish = dishOf(row);
      delete dish.pictureRef;
      return ok({ dish, before: row.picture_ref ?? undefined });
    },

    /** Deleting a dish never touches a menu or an order; a live menu that uses it is only flagged (D-062). */
    async deleteDish(id) {
      if (!(await dishRow(id))) return fail('not_found', 'Dish not found');
      const onLive = await db.first(
        `SELECT 1 AS hit FROM menu_items i JOIN menus m ON m.seller_id = i.seller_id
         WHERE i.seller_id = ? AND i.dish_id = ? AND m.state = 'live'`,
        sid,
        id,
      );
      await db.batch([
        db.stmt(
          'UPDATE menu_items SET dish_id = NULL WHERE seller_id = ? AND dish_id = ?',
          sid,
          id,
        ),
        db.stmt('DELETE FROM saved_set_dishes WHERE seller_id = ? AND dish_id = ?', sid, id),
        db.stmt('DELETE FROM dishes WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok({ usedOnLiveMenu: onLive !== null });
    },

    // ---- Saved sets of dishes ----

    async listDishSets() {
      const [sets, links] = await db.reads([
        db.stmt('SELECT * FROM saved_sets WHERE seller_id = ? ORDER BY position', sid),
        db.stmt(
          'SELECT set_id, dish_id FROM saved_set_dishes WHERE seller_id = ? ORDER BY set_id, position',
          sid,
        ),
      ]);
      return (sets as Array<SetRow>).map((set) => ({
        id: set.id,
        name: set.name,
        dishIds: (links as Array<SetDishRow>)
          .filter((link) => link.set_id === set.id)
          .map((link) => link.dish_id),
        timesUsed: set.times_used,
      }));
    },

    async createDishSet(input) {
      const [count, found] = await Promise.all([
        db.first<{ n: number }>('SELECT COUNT(*) AS n FROM saved_sets WHERE seller_id = ?', sid),
        db.all<{ id: string }>(
          `SELECT id FROM dishes WHERE seller_id = ? AND id IN (${marks(input.dishIds.length)})`,
          sid,
          ...input.dishIds,
        ),
      ]);
      if ((count?.n ?? 0) >= MAX_SETS) {
        return fail('limit_reached', `At most ${String(MAX_SETS)} sets`);
      }
      if (found.length !== input.dishIds.length) return fail('unknown_item', 'Unknown dish');
      const set = { id: deps.newId(), name: input.name, dishIds: input.dishIds, timesUsed: 0 };
      await db.batch(
        setStatements(db, sid, { ...set, dishIds: [...set.dishIds], images: {} }, count?.n ?? 0),
      );
      return ok({ ...set, dishIds: [...set.dishIds] });
    },

    /** D-094: appends one library dish to the menu; the other items are not touched. */
    async addDishToMenu(dishId) {
      const [row, items, dish] = await Promise.all([
        menuRow(),
        db.all<ItemRow>('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
        dishRow(dishId),
      ]);
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      if (!dish) return fail('unknown_item', 'Unknown dish');
      if (items.some((item) => item.dish_id === dishId)) {
        return fail('already_on_menu', 'This dish is already on the menu');
      }
      if (items.length >= MAX_MENU_ITEMS) {
        return fail('limit_reached', `At most ${String(MAX_MENU_ITEMS)} dishes on a menu`);
      }
      const top = items.reduce((max, item) => Math.max(max, item.position), -1);
      await db.batch(copyStatements([dish], top + 1));
      return ok(await readView());
    },

    /** Adds the set's dishes to the menu (those already on it stay as they are). */
    async useDishSet(id) {
      const [setRow, links, row, items] = await Promise.all([
        db.first<SetRow>('SELECT * FROM saved_sets WHERE seller_id = ? AND id = ?', sid, id),
        db.all<SetDishRow>(
          'SELECT set_id, dish_id FROM saved_set_dishes WHERE seller_id = ? AND set_id = ? ORDER BY position',
          sid,
          id,
        ),
        menuRow(),
        db.all<ItemRow>('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      ]);
      if (!setRow) return fail('not_found', 'Set not found');
      if (row.state === 'finished') return fail('week_closed', 'This menu is finished');
      const onMenu = new Set(items.map((item) => item.dish_id));
      const wanted = links.map((link) => link.dish_id).filter((dishId) => !onMenu.has(dishId));
      if (items.length + wanted.length > MAX_MENU_ITEMS) {
        return fail('limit_reached', `At most ${String(MAX_MENU_ITEMS)} dishes on a menu`);
      }
      const dishes =
        wanted.length === 0
          ? []
          : await db.all<DishRow>(
              `SELECT * FROM dishes WHERE seller_id = ? AND id IN (${marks(wanted.length)})`,
              sid,
              ...wanted,
            );
      const ordered = wanted.flatMap((dishId) => dishes.filter((dish) => dish.id === dishId));
      const top = items.reduce((max, item) => Math.max(max, item.position), -1);
      await db.batch([
        ...copyStatements(ordered, top + 1),
        db.stmt(
          'UPDATE saved_sets SET times_used = times_used + 1 WHERE seller_id = ? AND id = ?',
          sid,
          id,
        ),
      ]);
      return ok({ menu: await readView(), added: ordered.length });
    },
  };
}
