import type { Chef, Kitchen, KitchenSettings, MenuItem, SellerOrder, Week } from './domain';
import { MAX_CHEFS, MAX_MENU_ITEMS, MAX_SETS } from './limits';
import { parseChef, parseKitchen, parseWeek } from './menuContract';
import { parseOrder } from './orderContract';
import { isIsoDate, isRecord, parseArray } from './parse';
import { parsePastWeek, type PastWeek } from './pastWeeks';
import { parseSettingsRequest } from './sellerContract';
import { parseMenuItem, parseSavedSet, type SavedSet } from './setupContract';

export const BACKUP_VERSION = 1;
/** A year of weekly closes, with room to spare. */
export const MAX_PAST_WEEKS = 520;

/**
 * GET /api/seller/backup and the body of POST /api/seller/backup (restore). One seller's data:
 * kitchen with image references, settings, this week, menu, chefs, sets, orders, past weeks.
 * No customer phone numbers or addresses exist, so none are in it.
 */
export type BackupFile = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  seller: { slug: string; name: string };
  kitchen: Kitchen;
  settings: KitchenSettings;
  week: Week;
  items: Array<MenuItem>;
  chefs: Array<Chef>;
  sets: Array<SavedSet>;
  orders: Array<SellerOrder>;
  pastWeeks: Array<PastWeek>;
};

function unique(values: ReadonlyArray<string>): boolean {
  return new Set(values).size === values.length;
}

/** Validates a backup file; null if it is malformed, too big, or reuses an id, code or token. */
export function parseBackupFile(input: unknown): BackupFile | null {
  if (!isRecord(input) || input['version'] !== BACKUP_VERSION) return null;
  const { exportedAt } = input;
  const seller = input['seller'];
  const kitchen = parseKitchen(input['kitchen']);
  const settings = parseSettingsRequest(input['settings']);
  const week = parseWeek(input['week']);
  const items = parseArray(input['items'], parseMenuItem);
  const chefs = parseArray(input['chefs'], parseChef);
  const sets = parseArray(input['sets'], parseSavedSet);
  const orders = parseArray(input['orders'], parseOrder);
  const pastWeeks = parseArray(input['pastWeeks'], parsePastWeek);
  if (!isIsoDate(exportedAt) || !isRecord(seller)) return null;
  const { slug, name } = seller;
  if (typeof slug !== 'string' || typeof name !== 'string') return null;
  if (!kitchen || !settings || !week || !items || !chefs || !sets || !orders || !pastWeeks) {
    return null;
  }
  if (items.length > MAX_MENU_ITEMS || sets.length > MAX_SETS || chefs.length > MAX_CHEFS) {
    return null;
  }
  if (pastWeeks.length > MAX_PAST_WEEKS) return null;
  if (!unique(items.map((x) => x.id)) || !unique(chefs.map((x) => x.id))) return null;
  if (!unique(sets.map((x) => x.id)) || !unique(pastWeeks.map((x) => x.id))) return null;
  if (!unique(orders.map((x) => x.id)) || !unique(orders.map((x) => x.code))) return null;
  if (!unique(orders.map((x) => x.token))) return null;
  return {
    version: BACKUP_VERSION,
    exportedAt,
    seller: { slug, name },
    kitchen,
    settings,
    week,
    items,
    chefs,
    sets,
    orders,
    pastWeeks,
  };
}
