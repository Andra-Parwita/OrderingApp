// Shared pieces of the menu operations: the dependencies, the result helpers and the reads the
// groups have in common (split out of menus.ts, plan 098 C3; the code is unchanged).
import { DEFAULT_ZONE } from '../../shared/zone';
import type { InboxEntry, SellerOrder } from '../../shared/domain';
import { type MenuView, type Preferences } from '../../shared/menusContract';
import type { ApiErrorCode } from '../../shared/apiError';
import type { StoreResult } from '../repo/Repository';
import { marks, type D1Statement, type Db } from './d1';
import { itemFromDish, MENU_PLACES_SQL, sellerViews, USED_SQL } from './menuView';
import {
  dishOf,
  itemOf,
  menuOf,
  pickupOf,
  preferencesOf,
  type DishRow,
  type ItemRow,
  type MenuPlaceRow,
  type MenuRow,
  type PickupRow,
  type SettingsRow,
} from './rows';
import { itemStatement } from './write';

/** What the seller just told a customer: the order as it now is, and the inbox entries added (oldest first). */
export type CustomerNotice = { order: SellerOrder; entries: Array<InboxEntry> };

export type MenuDeps = {
  db: Db;
  now: () => Date;
  newId: () => string;
  /**
   * Called once a write that told customers something has finished (never inside it), so the Worker
   * can send web pushes afterwards (worker/push/dispatch.ts). Absent in most tests.
   */
  notify?: (notices: Array<CustomerNotice>) => void;
};

export function fail(error: ApiErrorCode, message: string) {
  return { ok: false as const, error, message };
}
export function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

export function createMenuContext(deps: MenuDeps, sid: string) {
  const { db } = deps;
  const nowIso = () => deps.now().toISOString();
  // The kitchen's zone (plan 077): the Worker itself runs in UTC.
  const zoneOf = async (): Promise<string> =>
    (
      await db.first<{ time_zone: string }>(
        'SELECT time_zone FROM kitchens WHERE seller_id = ?',
        sid,
      )
    )?.time_zone ?? DEFAULT_ZONE;

  async function readView(): Promise<MenuView> {
    const [menus, uses, points, items, used] = await db.reads([
      db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
      db.stmt(
        'SELECT place_id, window_start, window_end FROM menu_pickup_places WHERE seller_id = ? ORDER BY position',
        sid,
      ),
      db.stmt(MENU_PLACES_SQL, sid),
      db.stmt('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      db.stmt(`${USED_SQL} GROUP BY l.item_id`, sid),
    ]);
    const row = menus[0] as MenuRow | undefined;
    if (!row) throw new Error(`Seller ${sid} has no menu`);
    const usedMap = new Map(
      (used as Array<{ item_id: string; used: number }>).map((r) => [r.item_id, r.used]),
    );
    const itemRows = items as Array<ItemRow>;
    const views = sellerViews(itemRows.map(itemOf), usedMap);
    return {
      menu: menuOf(row, uses as Array<MenuPlaceRow>),
      dishes: views.map((view, index) => {
        const dishId = itemRows[index]?.dish_id;
        return { ...view, ...(dishId ? { dishId } : {}) };
      }),
      pickupPoints: (points as Array<PickupRow>).map(pickupOf),
    };
  }

  async function readPreferences(): Promise<Preferences> {
    const row = await db.first<SettingsRow>(
      'SELECT * FROM kitchen_settings WHERE seller_id = ?',
      sid,
    );
    return preferencesOf(row as SettingsRow);
  }

  async function menuRow(): Promise<MenuRow> {
    const row = await db.first<MenuRow>('SELECT * FROM menus WHERE seller_id = ?', sid);
    if (!row) throw new Error(`Seller ${sid} has no menu`);
    return row;
  }

  async function dishRow(id: string): Promise<DishRow | null> {
    return db.first<DishRow>('SELECT * FROM dishes WHERE seller_id = ? AND id = ?', sid, id);
  }

  async function chefExists(chefId: string): Promise<boolean> {
    return (
      (await db.first('SELECT 1 AS hit FROM chefs WHERE seller_id = ? AND id = ?', sid, chefId)) !==
      null
    );
  }

  /** The choices of library dishes (plan 111), oldest first (the order they were entered in). */
  async function choicesOf(dishIds: ReadonlyArray<string>): Promise<Map<string, Array<DishRow>>> {
    const found =
      dishIds.length === 0
        ? []
        : await db.all<DishRow>(
            `SELECT * FROM dishes WHERE seller_id = ? AND group_id IN (${marks(dishIds.length)}) ORDER BY rowid`,
            sid,
            ...dishIds,
          );
    const byGroup = new Map<string, Array<DishRow>>();
    for (const row of found) {
      byGroup.set(row.group_id as string, [...(byGroup.get(row.group_id as string) ?? []), row]);
    }
    return byGroup;
  }

  /**
   * Statements that put copies of library dishes on the menu from position `from`; each dish is
   * followed by copies of its choices (plan 111), so a dish takes 1 + its choices positions.
   */
  async function copyStatements(
    dishes: ReadonlyArray<DishRow>,
    from: number,
    known?: Map<string, Array<DishRow>>,
  ): Promise<Array<D1Statement>> {
    const choices = known ?? (await choicesOf(dishes.map((dish) => dish.id)));
    let position = from;
    return [
      ...dishes.flatMap((dish) => {
        const parentId = deps.newId();
        const own = choices.get(dish.id) ?? [];
        const parent = dishOf(dish);
        return [
          itemStatement(db, sid, itemFromDish(parent, parentId), position++, dish.id),
          ...own.map((choice) => {
            const rest = { ...parent };
            delete rest.limit;
            const copy = itemFromDish(
              {
                ...rest,
                name: dishOf(choice).name,
                ...(choice.portion_limit !== null ? { limit: choice.portion_limit } : {}),
              },
              deps.newId(),
              parentId,
            );
            return itemStatement(db, sid, copy, position++, choice.id);
          }),
        ];
      }),
      ...(dishes.length > 0
        ? [
            db.stmt(
              `UPDATE dishes SET last_used_at = ? WHERE seller_id = ? AND id IN (${marks(dishes.length)})`,
              nowIso(),
              sid,
              ...dishes.map((dish) => dish.id),
            ),
          ]
        : []),
    ];
  }
  return {
    deps,
    db,
    sid,
    nowIso,
    zoneOf,
    readView,
    readPreferences,
    menuRow,
    dishRow,
    chefExists,
    choicesOf,
    copyStatements,
  };
}

export type MenuContext = ReturnType<typeof createMenuContext>;
