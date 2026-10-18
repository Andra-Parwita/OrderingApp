// Pickup places, theme and menu defaults, and the per-chef summary (split out of menus.ts, plan 098 C3; the code is unchanged).
import type { PickupPoint } from '../../shared/domain';
import { MAX_PICKUP_PLACES } from '../../shared/limits';
import { type Preferences } from '../../shared/menusContract';
import { type ChefSummaryRow } from '../../shared/chefSummaryContract';
import type { SellerRepository } from '../repo/Repository';
import { pickupOf, type PickupRow } from './rows';
import { fail, ok, type MenuContext } from './menuContext';
import { parseSnapshot, readChefRows } from './menuFinish';

/** Pickup places, theme and menu defaults, and the per-chef summary. */
export function placesPart(
  c: MenuContext,
): Pick<
  SellerRepository,
  | 'listPickupPlaces'
  | 'createPickupPlace'
  | 'updatePickupPlace'
  | 'deletePickupPlace'
  | 'getPreferences'
  | 'getChefSummary'
  | 'setPreferences'
> {
  const { deps, db, sid, readPreferences } = c;
  return {
    // ---- Pickup places (D-061) ----

    async listPickupPlaces() {
      const rows = await db.all<PickupRow>(
        'SELECT * FROM pickup_places WHERE seller_id = ? ORDER BY position',
        sid,
      );
      return rows.map(pickupOf);
    },

    async createPickupPlace(input) {
      const counts = await db.first<{ n: number; top: number }>(
        'SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS top FROM pickup_places WHERE seller_id = ?',
        sid,
      );
      if ((counts?.n ?? 0) >= MAX_PICKUP_PLACES) {
        return fail(
          'pickup_place_limit',
          `At most ${String(MAX_PICKUP_PLACES)} pickup places; delete one first`,
        );
      }
      const place: PickupPoint = {
        id: deps.newId(),
        place: input.place,
        directions: { ...input.directions },
        window: { ...input.window },
        ...(input.address
          ? {
              address: input.address,
              ...(input.lat !== undefined && input.lng !== undefined
                ? { lat: input.lat, lng: input.lng }
                : {}),
            }
          : {}),
      };
      await db
        .stmt(
          `INSERT INTO pickup_places (seller_id, id, position, place, directions_en, directions_id, window_start, window_end, address, lat, lng)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sid,
          place.id,
          (counts?.top ?? -1) + 1,
          place.place,
          place.directions.en,
          place.directions.id,
          place.window.start,
          place.window.end,
          place.address ?? null,
          place.lat ?? null,
          place.lng ?? null,
        )
        .run();
      return ok(place);
    },

    async updatePickupPlace(id, patch) {
      const row = await db.first<PickupRow>(
        'SELECT * FROM pickup_places WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!row) return fail('not_found', 'Pickup place not found');
      const next = pickupOf(row);
      if (patch.place !== undefined) next.place = patch.place;
      if (patch.directions) next.directions = { ...patch.directions };
      if (patch.window) next.window = { ...patch.window };
      if (patch.address !== undefined) {
        // The address and its pin are replaced together (null removes them).
        delete next.address;
        delete next.lat;
        delete next.lng;
        if (patch.address) {
          next.address = patch.address;
          if (patch.lat != null && patch.lng != null) {
            next.lat = patch.lat;
            next.lng = patch.lng;
          }
        }
      }
      await db
        .stmt(
          `UPDATE pickup_places SET place = ?, directions_en = ?, directions_id = ?, window_start = ?, window_end = ?,
             address = ?, lat = ?, lng = ?
           WHERE seller_id = ? AND id = ?`,
          next.place,
          next.directions.en,
          next.directions.id,
          next.window.start,
          next.window.end,
          next.address ?? null,
          next.lat ?? null,
          next.lng ?? null,
          sid,
          id,
        )
        .run();
      return ok(next);
    },

    /** The place leaves any menu that used it; a live menu that did is only flagged (D-062). */
    async deletePickupPlace(id) {
      const found = await db.first(
        'SELECT 1 AS hit FROM pickup_places WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Pickup place not found');
      const onLive = await db.first(
        `SELECT 1 AS hit FROM menu_pickup_places u JOIN menus m ON m.seller_id = u.seller_id
         WHERE u.seller_id = ? AND u.place_id = ? AND m.state = 'live'`,
        sid,
        id,
      );
      await db.batch([
        db.stmt('DELETE FROM menu_pickup_places WHERE seller_id = ? AND place_id = ?', sid, id),
        db.stmt('DELETE FROM pickup_places WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok({ usedOnLiveMenu: onLive !== null });
    },

    // ---- Theme and menu defaults ----

    getPreferences: readPreferences,

    // Plan 069: one batch (chefs, dishes' chefs, two sums). Only the menu the kitchen has
    // (current, or finished and not yet replaced) still knows each dish's chef.
    async getChefSummary(id, asChefId) {
      const { menu: mine, seeIncome, rows } = await readChefRows(db, sid);
      let kept: { menuId: string; cookingDate: string; rows: Array<ChefSummaryRow> } | undefined;
      if (mine && (id === 'current' || id === mine.id)) {
        kept = { menuId: mine.id, cookingDate: mine.cooking_date, rows };
      } else {
        // Plan 069 stage 3: an older menu answers from the snapshot taken when it finished.
        const past = await db.first<{
          id: string;
          cooking_date: string;
          chef_summary: string | null;
        }>(
          'SELECT id, cooking_date, chef_summary FROM past_weeks WHERE seller_id = ? AND id = ?',
          sid,
          id,
        );
        const snapshot = past?.chef_summary ? parseSnapshot(past.chef_summary) : undefined;
        if (!past || !snapshot) return undefined;
        kept = { menuId: past.id, cookingDate: past.cooking_date, rows: snapshot };
      }
      if (asChefId !== undefined && !seeIncome) return 'private';
      const shown = kept.rows.filter((r) => asChefId === undefined || r.chefId === asChefId);
      return {
        menuId: kept.menuId,
        cookingDate: kept.cookingDate,
        rows: shown,
        totalPortions: shown.reduce((n, r) => n + r.portions, 0),
        totalCents: shown.reduce((n, r) => n + r.incomeCents, 0),
      };
    },

    async setPreferences(request) {
      const current = await readPreferences();
      const next: Preferences = {
        theme: request.theme ?? current.theme,
        menuDefaults: request.menuDefaults ?? current.menuDefaults,
        chefsSeeIncome: request.chefsSeeIncome ?? current.chefsSeeIncome ?? true,
      };
      await db
        .stmt(
          `UPDATE kitchen_settings SET theme = ?, default_cutoff_days = ?, default_cutoff_time = ?, default_delivery = ?,
             default_delivery_note_en = ?, default_delivery_note_id = ?, chefs_see_income = ? WHERE seller_id = ?`,
          next.theme,
          next.menuDefaults.cutoffDaysBefore,
          next.menuDefaults.cutoffTime,
          next.menuDefaults.delivery.available,
          next.menuDefaults.delivery.note.en,
          next.menuDefaults.delivery.note.id,
          next.chefsSeeIncome,
          sid,
        )
        .run();
      return next;
    },
  };
}
