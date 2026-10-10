// Menus and dishes (plan 001, stage 3): the menu with its states, "Your dishes", saved sets of dishes,
// saved pickup places, and the kitchen's theme and menu defaults. Records follow
// uxDesign/seller/docs/handoff.md -> Data model changes. Warn, never block (D-062): where a call
// could once be refused for orders, it now answers with a warning flag.
import type { Delivery, LocalText, PickupPoint, SellerMenuItemView } from './domain';
import { MAX_MENU_ITEMS, MAX_PICKUP_PLACES, SET_NAME_MAX } from './limits';
import { isInt, isIsoDate, isOneOf, isRecord, parseArray, parseLocalText } from './parse';
import { DEFAULT_THEME, THEMES, type ThemeName } from './themes';
import {
  INSTANT,
  LIMIT_MAX,
  PRICE_MAX,
  TIME,
  parseCreateItemRequest,
  parseSellerItem,
  parseTrimmedText,
  parseUpdateItemRequest,
  parseWindow,
  realDate,
  type CreateItemRequest,
  type UpdateItemRequest,
} from './setupContract';

// ---- Theme and menu defaults (D-064) ---------------------------------------------------------

export { THEMES, DEFAULT_THEME, type ThemeName };

/** A new menu's cut-off and delivery. Days before the cooking day, at a local time. */
export type MenuDefaults = { cutoffDaysBefore: number; cutoffTime: string; delivery: Delivery };
export const DEFAULT_MENU_DEFAULTS: MenuDefaults = {
  cutoffDaysBefore: 1,
  cutoffTime: '21:00',
  delivery: { available: false, note: { en: '', id: '' } },
};

export type Preferences = { theme: ThemeName; menuDefaults: MenuDefaults };

/** PUT /api/seller/preferences: either part, at least one. */
export type UpdatePreferencesRequest = { theme?: ThemeName; menuDefaults?: MenuDefaults };
/** GET and PUT /api/seller/preferences. */
export type PreferencesResponse = { preferences: Preferences };

export function parseMenuDefaults(input: unknown): MenuDefaults | null {
  if (!isRecord(input)) return null;
  const { cutoffDaysBefore, cutoffTime, delivery } = input;
  if (!isInt(cutoffDaysBefore, 0, 14) || typeof cutoffTime !== 'string' || !TIME.test(cutoffTime)) {
    return null;
  }
  if (!isRecord(delivery) || typeof delivery['available'] !== 'boolean') return null;
  const note = parseTrimmedText(delivery['note'], 200);
  if (!note) return null;
  return { cutoffDaysBefore, cutoffTime, delivery: { available: delivery['available'], note } };
}

export function parsePreferences(input: unknown): Preferences | null {
  if (!isRecord(input)) return null;
  const menuDefaults = parseMenuDefaults(input['menuDefaults']);
  return isOneOf(THEMES, input['theme']) && menuDefaults
    ? { theme: input['theme'], menuDefaults }
    : null;
}

export function parseUpdatePreferencesRequest(input: unknown): UpdatePreferencesRequest | null {
  if (!isRecord(input)) return null;
  const out: UpdatePreferencesRequest = {};
  if (input['theme'] !== undefined) {
    if (!isOneOf(THEMES, input['theme'])) return null;
    out.theme = input['theme'];
  }
  if (input['menuDefaults'] !== undefined) {
    const menuDefaults = parseMenuDefaults(input['menuDefaults']);
    if (!menuDefaults) return null;
    out.menuDefaults = menuDefaults;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parsePreferencesResponse(input: unknown): PreferencesResponse | null {
  if (!isRecord(input)) return null;
  const preferences = parsePreferences(input['preferences']);
  return preferences ? { preferences } : null;
}

// ---- Pickup places (D-061) -------------------------------------------------------------------

/** A saved place: the same shape as a pickup point, with its usual time. At most 5 per seller. */
export type PickupPlace = PickupPoint;

/** PATCH /api/seller/pickup-places/:id, at least one field. */
export type UpdatePickupPlaceRequest = {
  place?: string;
  directions?: LocalText;
  window?: PickupPoint['window'];
};

export type PickupPlaceResponse = { place: PickupPlace };
export type PickupPlacesResponse = { places: Array<PickupPlace> };
/** DELETE answer: the menu that is live keeps no place that was deleted (D-062: warn, not block). */
export type DeletePickupPlaceResponse = { ok: true; usedOnLiveMenu: boolean };

export function parseUpdatePickupPlaceRequest(input: unknown): UpdatePickupPlaceRequest | null {
  if (!isRecord(input)) return null;
  const out: UpdatePickupPlaceRequest = {};
  if (input['place'] !== undefined) {
    const place = input['place'];
    if (typeof place !== 'string' || place.trim() === '' || place.trim().length > 80) return null;
    out.place = place.trim();
  }
  if (input['directions'] !== undefined) {
    const directions = parseTrimmedText(input['directions'], 200);
    if (!directions) return null;
    out.directions = directions;
  }
  if (input['window'] !== undefined) {
    const window = parseWindow(input['window']);
    if (!window) return null;
    out.window = window;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parsePickupPlace(input: unknown): PickupPlace | null {
  if (!isRecord(input)) return null;
  const directions = parseLocalText(input['directions']);
  const window = parseWindow(input['window']);
  const { id, place } = input;
  if (typeof id !== 'string' || id === '' || typeof place !== 'string' || !directions || !window) {
    return null;
  }
  return { id, place, directions, window };
}

export function parsePickupPlaceResponse(input: unknown): PickupPlaceResponse | null {
  if (!isRecord(input)) return null;
  const place = parsePickupPlace(input['place']);
  return place ? { place } : null;
}

export function parsePickupPlacesResponse(input: unknown): PickupPlacesResponse | null {
  if (!isRecord(input)) return null;
  const places = parseArray(input['places'], parsePickupPlace);
  return places && places.length <= MAX_PICKUP_PLACES ? { places } : null;
}

export function parseDeletePickupPlaceResponse(input: unknown): DeletePickupPlaceResponse | null {
  return isRecord(input) && input['ok'] === true && typeof input['usedOnLiveMenu'] === 'boolean'
    ? { ok: true, usedOnLiveMenu: input['usedOnLiveMenu'] }
    : null;
}

// ---- Dishes: "Your dishes" -------------------------------------------------------------------

/**
 * A dish in the library: default price and limit; `chefId` absent means the whole kitchen. Menus
 * hold copies, so changing or deleting a dish never changes a menu or an order.
 */
export type Dish = {
  id: string;
  name: LocalText;
  description: LocalText;
  size: LocalText;
  priceCents: number;
  limit?: number;
  chefId?: string;
  /** When a menu last took a copy of it. */
  lastUsedAt?: string;
};

/** POST /api/seller/dishes: the same fields as a menu item (name, description, size, price, limit, chef). */
export type CreateDishRequest = CreateItemRequest;
/** PATCH /api/seller/dishes/:id, at least one field; `limit: null` and `chefId: null` clear them. */
export type UpdateDishRequest = Omit<UpdateItemRequest, 'soldOut'>;

export type DishResponse = { dish: Dish };
export type DishesResponse = { dishes: Array<Dish> };
/** DELETE answer. `usedOnLiveMenu` is the warning flag (D-062): the dish is gone from the library either way. */
export type DeleteDishResponse = { ok: true; usedOnLiveMenu: boolean };

export function parseCreateDishRequest(input: unknown): CreateDishRequest | null {
  return parseCreateItemRequest(input);
}

export function parseUpdateDishRequest(input: unknown): UpdateDishRequest | null {
  if (isRecord(input) && input['soldOut'] !== undefined) return null; // sold out is per menu
  return parseUpdateItemRequest(input);
}

export function parseDish(input: unknown): Dish | null {
  if (!isRecord(input)) return null;
  const { id, limit, chefId, lastUsedAt, priceCents } = input;
  const name = parseLocalText(input['name']);
  const description = parseLocalText(input['description']);
  const size = parseLocalText(input['size']);
  if (typeof id !== 'string' || id === '' || !name || !description || !size) return null;
  if (!isInt(priceCents, 0, PRICE_MAX)) return null;
  if (limit !== undefined && !isInt(limit, 1, LIMIT_MAX)) return null;
  if (chefId !== undefined && typeof chefId !== 'string') return null;
  if (lastUsedAt !== undefined && !isIsoDate(lastUsedAt)) return null;
  return {
    id,
    name,
    description,
    size,
    priceCents,
    ...(limit !== undefined ? { limit } : {}),
    ...(chefId !== undefined ? { chefId } : {}),
    ...(lastUsedAt !== undefined ? { lastUsedAt } : {}),
  };
}

export function parseDishResponse(input: unknown): DishResponse | null {
  if (!isRecord(input)) return null;
  const dish = parseDish(input['dish']);
  return dish ? { dish } : null;
}

export function parseDishesResponse(input: unknown): DishesResponse | null {
  if (!isRecord(input)) return null;
  const dishes = parseArray(input['dishes'], parseDish);
  return dishes ? { dishes } : null;
}

export function parseDeleteDishResponse(input: unknown): DeleteDishResponse | null {
  return isRecord(input) && input['ok'] === true && typeof input['usedOnLiveMenu'] === 'boolean'
    ? { ok: true, usedOnLiveMenu: input['usedOnLiveMenu'] }
    : null;
}

// ---- Saved sets: a name and a list of dishes -------------------------------------------------

export type DishSet = { id: string; name: string; dishIds: Array<string>; timesUsed: number };

/** POST /api/seller/saved-sets. */
export type CreateDishSetRequest = { name: string; dishIds: Array<string> };

export type DishSetResponse = { set: DishSet };
export type DishSetsResponse = { sets: Array<DishSet> };
/** POST /api/seller/saved-sets/:id/use: the menu after the set's dishes were added to it. */
export type UseDishSetResponse = { menu: MenuView; added: number };

function parseSetName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim();
  return name !== '' && name.length <= SET_NAME_MAX ? name : null;
}

function parseIdList(input: unknown, max: number): Array<string> | null {
  const ids = parseArray(input, (id) => (typeof id === 'string' && id !== '' ? id : null));
  return ids && ids.length <= max && new Set(ids).size === ids.length ? ids : null;
}

export function parseCreateDishSetRequest(input: unknown): CreateDishSetRequest | null {
  if (!isRecord(input)) return null;
  const name = parseSetName(input['name']);
  const dishIds = parseIdList(input['dishIds'], MAX_MENU_ITEMS);
  return name !== null && dishIds && dishIds.length > 0 ? { name, dishIds } : null;
}

export function parseDishSet(input: unknown): DishSet | null {
  if (!isRecord(input)) return null;
  const { id, timesUsed } = input;
  const name = parseSetName(input['name']);
  const dishIds = parseIdList(input['dishIds'], MAX_MENU_ITEMS);
  if (typeof id !== 'string' || id === '' || name === null || !dishIds) return null;
  if (!isInt(timesUsed, 0, 1_000_000)) return null;
  return { id, name, dishIds, timesUsed };
}

export function parseDishSetResponse(input: unknown): DishSetResponse | null {
  if (!isRecord(input)) return null;
  const set = parseDishSet(input['set']);
  return set ? { set } : null;
}

export function parseDishSetsResponse(input: unknown): DishSetsResponse | null {
  if (!isRecord(input)) return null;
  const sets = parseArray(input['sets'], parseDishSet);
  return sets ? { sets } : null;
}

// ---- The menu ---------------------------------------------------------------------------------

export const MENU_STATES = ['not_published', 'live', 'finished'] as const;
export type MenuState = (typeof MENU_STATES)[number];
/** Wizard steps: 0 Dishes, 1 Details, 2 Check, 3 Publish & share. */
export const WIZARD_STEP_MAX = 3;

export type TimeWindow = PickupPoint['window'];
/** A place the menu uses; `window` is this menu's own time, absent when the place's usual time applies. */
export type MenuPlaceUse = { placeId: string; window?: TimeWindow };

/** The one menu a seller has (D-063). */
export type Menu = {
  id: string;
  state: MenuState;
  /** Local date, YYYY-MM-DD (any day, D-056). */
  cookingDate: string;
  /** ISO instant with offset. */
  cutoffAt: string;
  delivery: Delivery;
  /** The menu picture (3:2, D-060). */
  pictureRef?: string;
  /** Furthest wizard step reached, 0 to WIZARD_STEP_MAX. */
  wizardStep: number;
  takingOrders: boolean;
  placeUses: Array<MenuPlaceUse>;
  publishedAt?: string;
  finishedAt?: string;
};

/** A dish on the menu: a copy with its own price, limit, chef and sold out; `dishId` is the library dish. */
export type MenuDishView = SellerMenuItemView & { dishId?: string };

/**
 * The menu as the seller's screens read it. `pickupPoints` are the places it uses, each with the
 * time that applies to this menu (the override, else the place's usual time).
 */
export type MenuView = {
  menu: Menu;
  dishes: Array<MenuDishView>;
  pickupPoints: Array<PickupPoint>;
};

/** POST /api/seller/menus: only once the current menu is finished. `cookingDate` defaults to the coming Saturday. */
export type CreateMenuRequest = { cookingDate?: string };

/**
 * PUT /api/seller/menus/current: any of these. `dishIds` makes the menu hold exactly these library
 * dishes (those already on it keep their own price and limit); `places` the places it uses, in order.
 * Allowed while live (edits are instant, D-069 Q2); refused once finished.
 */
export type UpdateMenuRequest = {
  cookingDate?: string;
  cutoffAt?: string;
  delivery?: Delivery;
  wizardStep?: number;
  takingOrders?: boolean;
  places?: Array<MenuPlaceUse>;
  dishIds?: Array<string>;
};

export type MenuViewResponse = { menu: MenuView };
/** PUT …/menus/current: `removedWithOrders` names menu dishes that were dropped although they have orders (D-062). */
export type UpdateMenuResponse = { menu: MenuView; warnings: { removedWithOrders: Array<string> } };
/** POST …/menus/current/finish. */
export type FinishMenuResponse = { menu: MenuView; closedOrders: number };

export function parseCreateMenuRequest(input: unknown): CreateMenuRequest | null {
  if (input === undefined) return {};
  if (!isRecord(input)) return null;
  const { cookingDate } = input;
  if (cookingDate === undefined) return {};
  return realDate(cookingDate) ? { cookingDate } : null;
}

function parsePlaceUse(input: unknown): MenuPlaceUse | null {
  if (!isRecord(input)) return null;
  const { placeId } = input;
  if (typeof placeId !== 'string' || placeId === '') return null;
  if (input['window'] === undefined) return { placeId };
  const window = parseWindow(input['window']);
  return window ? { placeId, window } : null;
}

export function parseUpdateMenuRequest(input: unknown): UpdateMenuRequest | null {
  if (!isRecord(input)) return null;
  const out: UpdateMenuRequest = {};
  if (input['cookingDate'] !== undefined) {
    if (!realDate(input['cookingDate'])) return null;
    out.cookingDate = input['cookingDate'];
  }
  if (input['cutoffAt'] !== undefined) {
    const cutoffAt = input['cutoffAt'];
    if (typeof cutoffAt !== 'string' || !INSTANT.test(cutoffAt)) return null;
    if (Number.isNaN(Date.parse(cutoffAt))) return null;
    out.cutoffAt = cutoffAt;
  }
  if (input['delivery'] !== undefined) {
    const delivery = input['delivery'];
    if (!isRecord(delivery) || typeof delivery['available'] !== 'boolean') return null;
    const note = parseTrimmedText(delivery['note'], 200);
    if (!note) return null;
    out.delivery = { available: delivery['available'], note };
  }
  if (input['wizardStep'] !== undefined) {
    if (!isInt(input['wizardStep'], 0, WIZARD_STEP_MAX)) return null;
    out.wizardStep = input['wizardStep'];
  }
  if (input['takingOrders'] !== undefined) {
    if (typeof input['takingOrders'] !== 'boolean') return null;
    out.takingOrders = input['takingOrders'];
  }
  if (input['places'] !== undefined) {
    const places = parseArray(input['places'], parsePlaceUse);
    if (!places || places.length > MAX_PICKUP_PLACES) return null;
    if (new Set(places.map((use) => use.placeId)).size !== places.length) return null;
    out.places = places;
  }
  if (input['dishIds'] !== undefined) {
    const dishIds = parseIdList(input['dishIds'], MAX_MENU_ITEMS);
    if (!dishIds) return null;
    out.dishIds = dishIds;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseMenu(input: unknown): Menu | null {
  if (!isRecord(input)) return null;
  const { id, state, cookingDate, cutoffAt, delivery, wizardStep, takingOrders } = input;
  const { pictureRef, publishedAt, finishedAt } = input;
  if (typeof id !== 'string' || id === '' || !isOneOf(MENU_STATES, state)) return null;
  if (!realDate(cookingDate) || !isIsoDate(cutoffAt)) return null;
  if (!isRecord(delivery) || typeof delivery['available'] !== 'boolean') return null;
  const note = parseLocalText(delivery['note']);
  const placeUses = parseArray(input['placeUses'], parsePlaceUse);
  if (!note || !placeUses || !isInt(wizardStep, 0, WIZARD_STEP_MAX)) return null;
  if (typeof takingOrders !== 'boolean') return null;
  if (pictureRef !== undefined && typeof pictureRef !== 'string') return null;
  if (publishedAt !== undefined && !isIsoDate(publishedAt)) return null;
  if (finishedAt !== undefined && !isIsoDate(finishedAt)) return null;
  return {
    id,
    state,
    cookingDate,
    cutoffAt,
    delivery: { available: delivery['available'], note },
    ...(pictureRef !== undefined ? { pictureRef } : {}),
    wizardStep,
    takingOrders,
    placeUses,
    ...(publishedAt !== undefined ? { publishedAt } : {}),
    ...(finishedAt !== undefined ? { finishedAt } : {}),
  };
}

function parseMenuDish(input: unknown): MenuDishView | null {
  const item = parseSellerItem(input);
  if (!item || !isRecord(input)) return null;
  const { dishId } = input;
  if (dishId !== undefined && typeof dishId !== 'string') return null;
  return { ...item, ...(dishId !== undefined ? { dishId } : {}) };
}

export function parseMenuView(input: unknown): MenuView | null {
  if (!isRecord(input)) return null;
  const menu = parseMenu(input['menu']);
  const dishes = parseArray(input['dishes'], parseMenuDish);
  const pickupPoints = parseArray(input['pickupPoints'], parsePickupPlace);
  return menu && dishes && pickupPoints ? { menu, dishes, pickupPoints } : null;
}

export function parseMenuViewResponse(input: unknown): MenuViewResponse | null {
  if (!isRecord(input)) return null;
  const menu = parseMenuView(input['menu']);
  return menu ? { menu } : null;
}

export function parseUpdateMenuResponse(input: unknown): UpdateMenuResponse | null {
  if (!isRecord(input) || !isRecord(input['warnings'])) return null;
  const menu = parseMenuView(input['menu']);
  const removed = parseIdList(input['warnings']['removedWithOrders'], 1000);
  return menu && removed ? { menu, warnings: { removedWithOrders: removed } } : null;
}

export function parseFinishMenuResponse(input: unknown): FinishMenuResponse | null {
  if (!isRecord(input)) return null;
  const menu = parseMenuView(input['menu']);
  return menu && isInt(input['closedOrders'], 0, 1_000_000)
    ? { menu, closedOrders: input['closedOrders'] }
    : null;
}

export function parseUseDishSetResponse(input: unknown): UseDishSetResponse | null {
  if (!isRecord(input)) return null;
  const menu = parseMenuView(input['menu']);
  return menu && isInt(input['added'], 0, MAX_MENU_ITEMS) ? { menu, added: input['added'] } : null;
}
