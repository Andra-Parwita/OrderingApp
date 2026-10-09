// Seller setup contracts (stage 6.1): week, menu items, chefs, saved sets, images.
import type {
  Chef,
  Delivery,
  KitchenImages,
  LocalText,
  MenuItem,
  PickupPoint,
  SellerMenuItemView,
  Week,
} from './domain';
import { isImageSlot, type ImageSlot } from './imageSlots';
import {
  CHEF_NAME_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_SIZE_MAX,
  MAX_MENU_ITEMS,
  SET_NAME_MAX,
} from './limits';
import { parseChef, parseImages, parseWeek } from './menuContract';
import { isInt, isRecord, parseArray, parseLocalText } from './parse';
import { parsePastWeekSummary, type PastWeekSummary } from './pastWeeks';

export type OkResponse = { ok: true };
export function parseOkResponse(input: unknown): OkResponse | null {
  return isRecord(input) && input['ok'] === true ? { ok: true } : null;
}

// ---- Week ------------------------------------------------------------------------------------

/** One pickup point for now (D-008); `id` is optional and kept from the current point if absent. */
export type PickupPointInput = Omit<PickupPoint, 'id'> & { id?: string };

/** PUT /api/seller/week. The ordering switch is a setting (PUT /api/seller/settings). */
export type WeekSettingsRequest = {
  cookingDate: string;
  /** ISO instant with an offset, e.g. 2026-10-09T21:00:00+11:00. */
  cutoffAt: string;
  pickupPoints: [PickupPointInput];
  delivery: Delivery;
};

/** GET/PUT /api/seller/week, POST …/week/publish and …/week/unpublish. */
export type WeekResponse = { week: Week };
/** POST /api/seller/week/close: the archived week, and the new draft week that replaces it. */
export type CloseWeekResponse = { week: Week; closed: PastWeekSummary };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function realDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(value);
}

function parseWindow(input: unknown): PickupPoint['window'] | null {
  if (!isRecord(input)) return null;
  const { start, end } = input;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  if (!TIME.test(start) || !TIME.test(end) || end <= start) return null;
  return { start, end };
}

function parseTrimmedText(input: unknown, max: number): LocalText | null {
  const text = parseLocalText(input);
  if (!text) return null;
  const trimmed = { en: text.en.trim(), id: text.id.trim() };
  return trimmed.en.length <= max && trimmed.id.length <= max ? trimmed : null;
}

function parsePickupPointInput(input: unknown): PickupPointInput | null {
  if (!isRecord(input)) return null;
  const { id, place } = input;
  const directions = parseTrimmedText(input['directions'], 200);
  const window = parseWindow(input['window']);
  if (typeof place !== 'string' || place.trim() === '' || place.trim().length > 80) return null;
  if (!directions || !window) return null;
  if (id !== undefined && (typeof id !== 'string' || id === '')) return null;
  return { ...(id !== undefined ? { id } : {}), place: place.trim(), directions, window };
}

export function parseWeekSettingsRequest(input: unknown): WeekSettingsRequest | null {
  if (!isRecord(input)) return null;
  const { cookingDate, cutoffAt, delivery } = input;
  if (!realDate(cookingDate) || typeof cutoffAt !== 'string' || !INSTANT.test(cutoffAt)) {
    return null;
  }
  if (Number.isNaN(Date.parse(cutoffAt))) return null;
  const points = parseArray(input['pickupPoints'], parsePickupPointInput);
  const first = points?.[0];
  if (!points || points.length !== 1 || !first) return null; // exactly one for now (D-008)
  if (!isRecord(delivery) || typeof delivery['available'] !== 'boolean') return null;
  const note = parseTrimmedText(delivery['note'], 200);
  if (!note) return null;
  return {
    cookingDate,
    cutoffAt,
    pickupPoints: [first],
    delivery: { available: delivery['available'], note },
  };
}

export function parseWeekResponse(input: unknown): WeekResponse | null {
  if (!isRecord(input)) return null;
  const week = parseWeek(input['week']);
  return week ? { week } : null;
}

// ---- Menu items ------------------------------------------------------------------------------

/** POST /api/seller/menu/items. Description and size default to empty. */
export type CreateItemRequest = {
  name: LocalText;
  description?: LocalText;
  size?: LocalText;
  priceCents: number;
  limit?: number;
  chefId?: string;
};

/**
 * PATCH /api/seller/menu/items/:id, at least one field. `limit: null` removes the limit,
 * `chefId: null` removes the chef; `soldOut` is the manual switch. Edits only affect new orders.
 */
export type UpdateItemRequest = {
  name?: LocalText;
  description?: LocalText;
  size?: LocalText;
  priceCents?: number;
  limit?: number | null;
  chefId?: string | null;
  soldOut?: boolean;
};

/** PUT /api/seller/menu/order: every item id once, in the new order. */
export type ReorderItemsRequest = { ids: Array<string> };

export type ItemResponse = { item: SellerMenuItemView };
export type ItemsResponse = { items: Array<SellerMenuItemView> };

/** A name must say something in at least one language (the other then shows the same text). */
function parseItemName(input: unknown): LocalText | null {
  const name = parseTrimmedText(input, ITEM_NAME_MAX);
  return name && (name.en !== '' || name.id !== '') ? name : null;
}

const PRICE_MAX = 1_000_000;
const LIMIT_MAX = 10_000;

export function parseCreateItemRequest(input: unknown): CreateItemRequest | null {
  if (!isRecord(input)) return null;
  const name = parseItemName(input['name']);
  const description =
    input['description'] === undefined
      ? undefined
      : parseTrimmedText(input['description'], ITEM_DESCRIPTION_MAX);
  const size =
    input['size'] === undefined ? undefined : parseTrimmedText(input['size'], ITEM_SIZE_MAX);
  const { priceCents, limit, chefId } = input;
  if (!name || description === null || size === null || !isInt(priceCents, 0, PRICE_MAX)) {
    return null;
  }
  if (limit !== undefined && !isInt(limit, 1, LIMIT_MAX)) return null;
  if (chefId !== undefined && (typeof chefId !== 'string' || chefId === '')) return null;
  return {
    name,
    ...(description ? { description } : {}),
    ...(size ? { size } : {}),
    priceCents,
    ...(limit !== undefined ? { limit } : {}),
    ...(chefId !== undefined ? { chefId } : {}),
  };
}

export function parseUpdateItemRequest(input: unknown): UpdateItemRequest | null {
  if (!isRecord(input)) return null;
  const out: UpdateItemRequest = {};
  if (input['name'] !== undefined) {
    const name = parseItemName(input['name']);
    if (!name) return null;
    out.name = name;
  }
  if (input['description'] !== undefined) {
    const description = parseTrimmedText(input['description'], ITEM_DESCRIPTION_MAX);
    if (!description) return null;
    out.description = description;
  }
  if (input['size'] !== undefined) {
    const size = parseTrimmedText(input['size'], ITEM_SIZE_MAX);
    if (!size) return null;
    out.size = size;
  }
  if (input['priceCents'] !== undefined) {
    if (!isInt(input['priceCents'], 0, PRICE_MAX)) return null;
    out.priceCents = input['priceCents'];
  }
  if (input['limit'] !== undefined) {
    if (input['limit'] !== null && !isInt(input['limit'], 1, LIMIT_MAX)) return null;
    out.limit = input['limit'];
  }
  if (input['chefId'] !== undefined) {
    const chefId = input['chefId'];
    if (chefId !== null && (typeof chefId !== 'string' || chefId === '')) return null;
    out.chefId = chefId;
  }
  if (input['soldOut'] !== undefined) {
    if (typeof input['soldOut'] !== 'boolean') return null;
    out.soldOut = input['soldOut'];
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseReorderItemsRequest(input: unknown): ReorderItemsRequest | null {
  if (!isRecord(input)) return null;
  const ids = parseArray(input['ids'], (id) => (typeof id === 'string' && id !== '' ? id : null));
  return ids && ids.length <= MAX_MENU_ITEMS && new Set(ids).size === ids.length ? { ids } : null;
}

/** A stored menu item (used by the backup file). */
export function parseMenuItem(input: unknown): MenuItem | null {
  if (!isRecord(input)) return null;
  const { id, soldOut } = input;
  const name = parseLocalText(input['name']);
  const description = parseLocalText(input['description']);
  const size = parseLocalText(input['size']);
  const { priceCents, limit, chefId } = input;
  if (typeof id !== 'string' || id === '' || !name || !description || !size) return null;
  if (!isInt(priceCents, 0, PRICE_MAX)) return null;
  if (limit !== undefined && !isInt(limit, 1, LIMIT_MAX)) return null;
  if (chefId !== undefined && typeof chefId !== 'string') return null;
  if (soldOut !== undefined && typeof soldOut !== 'boolean') return null;
  return {
    id,
    name,
    description,
    size,
    priceCents,
    ...(limit !== undefined ? { limit } : {}),
    ...(chefId !== undefined ? { chefId } : {}),
    ...(soldOut !== undefined ? { soldOut } : {}),
  };
}

export function parseItemResponse(input: unknown): ItemResponse | null {
  if (!isRecord(input)) return null;
  const item = parseSellerItem(input['item']);
  return item ? { item } : null;
}

export function parseItemsResponse(input: unknown): ItemsResponse | null {
  if (!isRecord(input)) return null;
  const items = parseArray(input['items'], parseSellerItem);
  return items ? { items } : null;
}

function parseSellerItem(input: unknown): SellerMenuItemView | null {
  if (!isRecord(input)) return null;
  const { chefId, manualSoldOut, remaining, soldOut } = input;
  const base = parseMenuItem({ ...input, soldOut: undefined });
  if (!base || (remaining !== null && !isInt(remaining, 0, 10_000))) return null;
  if (typeof soldOut !== 'boolean') return null;
  if (manualSoldOut !== undefined && typeof manualSoldOut !== 'boolean') return null;
  return {
    ...base,
    remaining,
    soldOut,
    ...(chefId !== undefined && typeof chefId === 'string' ? { chefId } : {}),
    ...(manualSoldOut !== undefined ? { manualSoldOut } : {}),
  };
}

// ---- Chefs -----------------------------------------------------------------------------------

/** POST /api/seller/chefs and PATCH /api/seller/chefs/:id. Deleting a chef unassigns their items. */
export type ChefNameRequest = { name: string };
export type ChefResponse = { chef: Chef };
export type ChefsResponse = { chefs: Array<Chef> };

export function parseChefNameRequest(input: unknown): ChefNameRequest | null {
  if (!isRecord(input) || typeof input['name'] !== 'string') return null;
  const name = input['name'].trim();
  return name !== '' && name.length <= CHEF_NAME_MAX ? { name } : null;
}

export function parseChefResponse(input: unknown): ChefResponse | null {
  if (!isRecord(input)) return null;
  const chef = parseChef(input['chef']);
  return chef ? { chef } : null;
}

export function parseChefsResponse(input: unknown): ChefsResponse | null {
  if (!isRecord(input)) return null;
  const chefs = parseArray(input['chefs'], parseChef);
  return chefs ? { chefs } : null;
}

// ---- Saved sets ------------------------------------------------------------------------------

export type SavedSetItem = Omit<MenuItem, 'id' | 'soldOut'>;

/** A saved set as stored (and in the backup): items without ids, and the image references. */
export type SavedSet = {
  id: string;
  name: string;
  items: Array<SavedSetItem>;
  images: KitchenImages;
};

/** A saved set as listed: which image slots it holds, not the pictures. */
export type SavedSetView = {
  id: string;
  name: string;
  items: Array<SavedSetItem>;
  imageSlots: Array<ImageSlot>;
};

/** POST /api/seller/sets: save this week's items (and images) as a set. A 6th needs `replaceSetId`. */
export type SaveSetRequest = { name: string; replaceSetId?: string };
/** PATCH /api/seller/sets/:id */
export type RenameSetRequest = { name: string };
/**
 * POST /api/seller/sets/:id/use: replaces the draft week's items. `confirm` must be true when the
 * week already has items; `applyImages` also takes the set's pictures.
 */
export type UseSetRequest = { confirm?: boolean; applyImages?: boolean };

export type SetResponse = { set: SavedSetView };
export type SetsResponse = { sets: Array<SavedSetView> };

function parseSetName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim();
  return name !== '' && name.length <= SET_NAME_MAX ? name : null;
}

export function parseSaveSetRequest(input: unknown): SaveSetRequest | null {
  if (!isRecord(input)) return null;
  const name = parseSetName(input['name']);
  const replace = input['replaceSetId'];
  if (name === null || (replace !== undefined && (typeof replace !== 'string' || replace === ''))) {
    return null;
  }
  return { name, ...(replace !== undefined ? { replaceSetId: replace } : {}) };
}

export function parseRenameSetRequest(input: unknown): RenameSetRequest | null {
  if (!isRecord(input)) return null;
  const name = parseSetName(input['name']);
  return name === null ? null : { name };
}

export function parseUseSetRequest(input: unknown): UseSetRequest | null {
  if (input === undefined) return {};
  if (!isRecord(input)) return null;
  const { confirm, applyImages } = input;
  if (confirm !== undefined && typeof confirm !== 'boolean') return null;
  if (applyImages !== undefined && typeof applyImages !== 'boolean') return null;
  return {
    ...(confirm !== undefined ? { confirm } : {}),
    ...(applyImages !== undefined ? { applyImages } : {}),
  };
}

function parseSavedSetItem(input: unknown): SavedSetItem | null {
  const item = parseMenuItem(isRecord(input) ? { ...input, id: 'x' } : input);
  if (!item) return null;
  return {
    name: item.name,
    description: item.description,
    size: item.size,
    priceCents: item.priceCents,
    ...(item.limit !== undefined ? { limit: item.limit } : {}),
    ...(item.chefId !== undefined ? { chefId: item.chefId } : {}),
  };
}

/** A stored set (backup file). */
export function parseSavedSet(input: unknown): SavedSet | null {
  if (!isRecord(input)) return null;
  const { id } = input;
  const name = parseSetName(input['name']);
  const items = parseArray(input['items'], parseSavedSetItem);
  const images = parseImages(input['images']);
  if (typeof id !== 'string' || id === '' || name === null || !items || !images) return null;
  if (items.length > MAX_MENU_ITEMS) return null;
  return { id, name, items, images };
}

export function parseSavedSetView(input: unknown): SavedSetView | null {
  if (!isRecord(input)) return null;
  const { id } = input;
  const name = parseSetName(input['name']);
  const items = parseArray(input['items'], parseSavedSetItem);
  const imageSlots = parseArray(input['imageSlots'], (slot) => (isImageSlot(slot) ? slot : null));
  if (typeof id !== 'string' || id === '' || name === null || !items || !imageSlots) return null;
  return { id, name, items, imageSlots };
}

export function parseSetResponse(input: unknown): SetResponse | null {
  if (!isRecord(input)) return null;
  const set = parseSavedSetView(input['set']);
  return set ? { set } : null;
}

export function parseSetsResponse(input: unknown): SetsResponse | null {
  if (!isRecord(input)) return null;
  const sets = parseArray(input['sets'], parseSavedSetView);
  return sets ? { sets } : null;
}

// ---- Images ----------------------------------------------------------------------------------

/** PUT /api/seller/images/:slot: a data URL, already resized (slotSpec), at most 600 KB. */
export type UploadImageRequest = { dataUrl: string };
/**
 * PUT /api/seller/images: the banner colour ("#rrggbb", null removes it) and the alt text (both
 * languages empty removes it). Absent fields stay as they are.
 */
export type ImageStyleRequest = { bannerBackground?: string | null; alt?: LocalText };
export type ImagesResponse = { images: KitchenImages };

export function parseUploadImageRequest(input: unknown): UploadImageRequest | null {
  return isRecord(input) && typeof input['dataUrl'] === 'string'
    ? { dataUrl: input['dataUrl'] }
    : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function parseImageStyleRequest(input: unknown): ImageStyleRequest | null {
  if (!isRecord(input)) return null;
  const out: ImageStyleRequest = {};
  const colour = input['bannerBackground'];
  if (colour !== undefined) {
    if (colour !== null && (typeof colour !== 'string' || !HEX.test(colour))) return null;
    out.bannerBackground = colour;
  }
  if (input['alt'] !== undefined) {
    const alt = parseTrimmedText(input['alt'], 200);
    if (!alt) return null;
    out.alt = alt;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseImagesResponse(input: unknown): ImagesResponse | null {
  if (!isRecord(input)) return null;
  const images = parseImages(input['images']);
  return images ? { images } : null;
}

export function parseCloseWeekResponse(input: unknown): CloseWeekResponse | null {
  if (!isRecord(input)) return null;
  const week = parseWeekResponse(input);
  const closed = parsePastWeekSummary(input['closed']);
  return week && closed ? { week: week.week, closed } : null;
}
