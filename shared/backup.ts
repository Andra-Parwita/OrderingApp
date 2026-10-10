import type { Chef, Kitchen, KitchenSettings, MenuItem, SellerOrder, Week } from './domain';
import { MAX_CHEFS, MAX_DISHES, MAX_MENU_ITEMS, MAX_PICKUP_PLACES, MAX_SETS } from './limits';
import { parseMessageLogEntry, type MessageLogEntry } from './handoverContract';
import { parseChef, parseKitchen, parseWeek } from './menuContract';
import { parseOrder } from './orderContract';
import { isIsoDate, isRecord, parseArray } from './parse';
import { parsePastWeek, type PastWeek } from './pastWeeks';
import { parseSettingsRequest } from './sellerContract';
import {
  parseDish,
  parseDishSet,
  parseMenu,
  parsePickupPlace,
  parsePreferences,
  type Dish,
  type DishSet,
  type Menu,
  type PickupPlace,
  type Preferences,
} from './menusContract';
import { parseMenuItem, parseSavedSet, type SavedSet } from './setupContract';

export const BACKUP_VERSION = 1;
/** A year of weekly closes, with room to spare. */
export const MAX_PAST_WEEKS = 520;
/** One menu's log: a few messages per place and per delivery, with room to spare. */
const MAX_MESSAGE_LOG = 1000;

/**
 * GET /api/seller/backup and the body of POST /api/seller/backup (restore). One seller's data:
 * kitchen with image references, settings, this week, menu, chefs, sets, orders, past weeks.
 * No customer phone numbers or addresses exist, so none are in it.
 *
 * Plan 001 stage 3 added the records below the line. Same version: a file without them (made
 * before) still restores, and their parts are rebuilt from `week`, `items` and `sets`.
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
  // ---- plan 001 stage 3 ----
  /** The menu with its state, wizard step, picture, taking-orders switch and per-menu place times. */
  menu?: Menu;
  /** The saved pickup places (up to 5). */
  pickupPlaces?: Array<PickupPlace>;
  /** "Your dishes". */
  dishes?: Array<Dish>;
  /** Which library dish each menu item (by item id) is a copy of. */
  itemDishIds?: Record<string, string>;
  /** Saved sets as lists of dish ids with their use count (`sets` keeps the item copies and images). */
  dishSets?: Array<DishSet>;
  /** Colour theme and menu defaults. */
  preferences?: Preferences;
  // ---- plan 001 stage 4 ----
  // Orders in `orders` and `pastWeeks` also carry `pickupPlaceId`, `packed`, `collectedAt`,
  // `collectedBy` and a `ticked` flag per line, each optional.
  /** The message log of the current menu. */
  messageLog?: Array<MessageLogEntry>;
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
  const extra = parseExtra(input);
  if (!extra) return null;
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
    ...extra,
  };
}

type Extra = Pick<
  BackupFile,
  'menu' | 'pickupPlaces' | 'dishes' | 'itemDishIds' | 'dishSets' | 'preferences' | 'messageLog'
>;

/** The stage 3 records, each optional; null if one is present but malformed or points at nothing. */
function parseExtra(input: Record<string, unknown>): Extra | null {
  const out: Extra = {};
  if (input['menu'] !== undefined) {
    const menu = parseMenu(input['menu']);
    if (!menu) return null;
    out.menu = menu;
  }
  if (input['pickupPlaces'] !== undefined) {
    const places = parseArray(input['pickupPlaces'], parsePickupPlace);
    if (!places || places.length > MAX_PICKUP_PLACES) return null;
    out.pickupPlaces = places;
  }
  if (input['dishes'] !== undefined) {
    const dishes = parseArray(input['dishes'], parseDish);
    if (!dishes || dishes.length > MAX_DISHES || !unique(dishes.map((x) => x.id))) return null;
    out.dishes = dishes;
  }
  if (input['itemDishIds'] !== undefined) {
    const links = input['itemDishIds'];
    if (!isRecord(links)) return null;
    const checked: Record<string, string> = {};
    for (const [itemId, dishId] of Object.entries(links)) {
      if (typeof dishId !== 'string' || dishId === '') return null;
      checked[itemId] = dishId;
    }
    out.itemDishIds = checked;
  }
  if (input['dishSets'] !== undefined) {
    const dishSets = parseArray(input['dishSets'], parseDishSet);
    if (!dishSets || dishSets.length > MAX_SETS || !unique(dishSets.map((x) => x.id))) return null;
    out.dishSets = dishSets;
  }
  if (input['preferences'] !== undefined) {
    const preferences = parsePreferences(input['preferences']);
    if (!preferences) return null;
    out.preferences = preferences;
  }
  if (input['messageLog'] !== undefined) {
    const log = parseArray(input['messageLog'], parseMessageLogEntry);
    if (!log || log.length > MAX_MESSAGE_LOG || !unique(log.map((x) => x.id))) return null;
    out.messageLog = log;
  }
  // Links must point at something in the file, or the restore would break a foreign key.
  const dishIds = new Set(out.dishes?.map((dish) => dish.id));
  const placeIds = new Set(out.pickupPlaces?.map((place) => place.id));
  if (out.menu?.placeUses.some((use) => !placeIds.has(use.placeId))) return null;
  if (out.menu && !unique(out.menu.placeUses.map((use) => use.placeId))) return null;
  if (out.dishSets?.some((set) => set.dishIds.some((id) => !dishIds.has(id)))) return null;
  if (Object.values(out.itemDishIds ?? {}).some((id) => !dishIds.has(id))) return null;
  return out;
}
