// The seller's image, saved-set and past-week reads: closures over one database and seller, split
// out of sellerContext.ts (move only, the code is unchanged).
import type { KitchenImages } from '../../shared/domain';
import { IMAGE_SLOTS } from '../../shared/imageSlots';
import { type PastWeekSummary } from '../../shared/pastWeeks';
import type { SavedSet } from '../../shared/setupContract';
import { type D1Statement, type Db } from './d1';
import { dropExpiredDetails } from './retention';
import {
  imagesOf,
  setItemOf,
  type DishRow,
  type ImageRow,
  type KitchenRow,
  type SetDishRow,
  type SetImageRow,
  type SetRow,
} from './rows';

export function createSellerReads(db: Db, now: () => Date, sid: string) {
  const nowIso = () => now().toISOString();

  async function readImages(): Promise<KitchenImages> {
    const [kitchens, images] = await db.reads([
      db.stmt('SELECT * FROM kitchens WHERE seller_id = ?', sid),
      db.stmt('SELECT slot, ref FROM kitchen_images WHERE seller_id = ?', sid),
    ]);
    const row = kitchens[0] as KitchenRow;
    return imagesOf(
      images as Array<ImageRow>,
      row.banner_background,
      row.image_alt_en,
      row.image_alt_id,
    );
  }

  /** Replaces the kitchen's image slots, colour and alt text with `next`. */
  function imageStatements(next: KitchenImages): Array<D1Statement> {
    const statements = [
      db.stmt(
        'UPDATE kitchens SET banner_background = ?, image_alt_en = ?, image_alt_id = ? WHERE seller_id = ?',
        next.bannerBackground ?? null,
        next.alt?.en ?? '',
        next.alt?.id ?? '',
        sid,
      ),
      db.stmt('DELETE FROM kitchen_images WHERE seller_id = ?', sid),
    ];
    for (const slot of IMAGE_SLOTS) {
      const ref = next[slot];
      if (ref === undefined) continue;
      statements.push(
        db.stmt(
          'INSERT INTO kitchen_images (seller_id, slot, ref, updated_at) VALUES (?, ?, ?, ?)',
          sid,
          slot,
          ref,
          nowIso(),
        ),
      );
    }
    return statements;
  }

  /** plan 001: a saved set is a list of library dishes; `items` is the legacy item-copy view of them. */
  type FullSet = SavedSet & { dishIds: Array<string>; timesUsed: number };

  async function readSets(): Promise<Array<FullSet>> {
    const [sets, links, dishes, images] = await db.reads([
      db.stmt('SELECT * FROM saved_sets WHERE seller_id = ? ORDER BY position', sid),
      db.stmt(
        'SELECT set_id, dish_id FROM saved_set_dishes WHERE seller_id = ? ORDER BY set_id, position',
        sid,
      ),
      db.stmt('SELECT * FROM dishes WHERE seller_id = ?', sid),
      db.stmt('SELECT set_id, slot, ref FROM saved_set_images WHERE seller_id = ?', sid),
    ]);
    const dishById = new Map((dishes as Array<DishRow>).map((dish) => [dish.id, dish]));
    return (sets as Array<SetRow>).map((set) => {
      const dishIds = (links as Array<SetDishRow>)
        .filter((link) => link.set_id === set.id)
        .map((link) => link.dish_id);
      return {
        id: set.id,
        name: set.name,
        dishIds,
        timesUsed: set.times_used,
        items: dishIds.flatMap((dishId) => {
          const dish = dishById.get(dishId);
          return dish ? [setItemOf(dish)] : [];
        }),
        images: imagesOf(
          (images as Array<SetImageRow>).filter((i) => i.set_id === set.id),
          set.banner_background,
          set.image_alt_en,
          set.image_alt_id,
        ),
      };
    });
  }

  // ---- Past weeks ----

  type PastRow = {
    id: string;
    cooking_date: string;
    closed_at: string;
    orders_count: number;
    cancelled_count: number;
    income_cents: number;
    paid_cents: number;
    unpaid_cents: number;
    details_dropped_at: string | null;
    picture_ref: string | null;
  };
  type PastItemRow = {
    past_week_id: string;
    item_id: string;
    name_en: string;
    name_id: string;
    qty: number;
  };

  /** The reads behind the history (plan 113: the backup sends them with its other reads). */
  function pastWeekStatements(): Array<D1Statement> {
    return [
      db.stmt('SELECT * FROM past_weeks WHERE seller_id = ? ORDER BY rowid DESC', sid),
      db.stmt(
        'SELECT * FROM past_week_items WHERE seller_id = ? ORDER BY past_week_id, position',
        sid,
      ),
    ];
  }

  function pastWeeksOf(weeks: Array<unknown>, items: Array<unknown>): Array<PastWeekSummary> {
    return (weeks as Array<PastRow>).map((week) => ({
      id: week.id,
      cookingDate: week.cooking_date,
      closedAt: week.closed_at,
      totals: {
        orders: week.orders_count,
        cancelled: week.cancelled_count,
        incomeCents: week.income_cents,
        paidCents: week.paid_cents,
        unpaidCents: week.unpaid_cents,
        items: (items as Array<PastItemRow>)
          .filter((item) => item.past_week_id === week.id)
          .map((item) => ({
            itemId: item.item_id,
            name: { en: item.name_en, id: item.name_id },
            qty: item.qty,
          })),
      },
      hasOrders: week.details_dropped_at === null,
      ...(week.picture_ref !== null ? { pictureUrl: week.picture_ref } : {}),
    }));
  }

  async function readPastWeeks(): Promise<Array<PastWeekSummary>> {
    await dropExpiredDetails(db, now(), sid);
    const [weeks, items] = await db.reads(pastWeekStatements());
    return pastWeeksOf(weeks, items);
  }

  return {
    readImages,
    imageStatements,
    readSets,
    readPastWeeks,
    pastWeekStatements,
    pastWeeksOf,
  };
}
