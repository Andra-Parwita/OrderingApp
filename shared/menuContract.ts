import type {
  Chef,
  Seller,
  Kitchen,
  KitchenImages,
  MenuItemView,
  OrderingState,
  PickupPoint,
  SellerMenuItemView,
  Week,
} from './domain';
import { isHexColour } from './kitchenImages';
import { MAX_MENU_ITEMS } from './limits';
import { parseSeller } from './seller';
import { isInt, isIsoDate, isOneOf, isRecord, parseArray, parseLocalText } from './parse';

/** GET /api/s/:slug/menu: public. Never carries chefs or chef ids (D-012). */
export type MenuResponse = {
  seller: Seller;
  kitchen: Kitchen;
  week: Week;
  items: Array<MenuItemView>;
  ordering: OrderingState;
};

/** GET /api/seller/menu (of the X-Seller seller): the same menu plus the chef grouping. */
export type SellerMenuResponse = Omit<MenuResponse, 'items'> & {
  chefs: Array<Chef>;
  items: Array<SellerMenuItemView>;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const IMAGE_KEYS = [
  'railImage',
  'railIcon',
  'desktopBanner',
  'phoneBanner',
  'bannerBackgroundImage',
] as const;

function parseImages(input: unknown): KitchenImages | null {
  if (!isRecord(input)) return null;
  const images: KitchenImages = {};
  for (const key of IMAGE_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return null;
    images[key] = value;
  }
  const background = input['bannerBackground'];
  if (background !== undefined) {
    if (!isHexColour(background)) return null;
    images.bannerBackground = background;
  }
  if (input['alt'] !== undefined) {
    const alt = parseLocalText(input['alt']);
    if (!alt) return null;
    images.alt = alt;
  }
  return images;
}

function parseKitchen(input: unknown): Kitchen | null {
  if (!isRecord(input)) return null;
  const tagline = parseLocalText(input['tagline']);
  const banner = input['bannerImageUrl'];
  const { sellerId } = input;
  if (typeof sellerId !== 'string' || sellerId === '') return null;
  if (typeof input['name'] !== 'string' || !tagline) return null;
  const whatsapp = input['whatsappNumber'];
  if (banner !== undefined && typeof banner !== 'string') return null;
  if (whatsapp !== undefined && typeof whatsapp !== 'string') return null;
  const images = input['images'] === undefined ? undefined : parseImages(input['images']);
  if (images === null) return null;
  return {
    sellerId,
    name: input['name'],
    tagline,
    ...(banner !== undefined ? { bannerImageUrl: banner } : {}),
    ...(images !== undefined ? { images } : {}),
    ...(whatsapp !== undefined ? { whatsappNumber: whatsapp } : {}),
  };
}

function parsePickupPoint(input: unknown): PickupPoint | null {
  if (!isRecord(input)) return null;
  const directions = parseLocalText(input['directions']);
  const window = input['window'];
  if (typeof input['id'] !== 'string' || typeof input['place'] !== 'string' || !directions) {
    return null;
  }
  if (!isRecord(window)) return null;
  const { start, end } = window;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  if (!TIME.test(start) || !TIME.test(end)) return null;
  return { id: input['id'], place: input['place'], directions, window: { start, end } };
}

function parseWeek(input: unknown): Week | null {
  if (!isRecord(input)) return null;
  const { cookingDate, cutoffAt, status, delivery } = input;
  const pickupPoints = parseArray(input['pickupPoints'], parsePickupPoint);
  if (typeof cookingDate !== 'string' || !DATE.test(cookingDate)) return null;
  if (!isIsoDate(cutoffAt) || !isOneOf(['draft', 'published'], status)) return null;
  if (!pickupPoints || !isRecord(delivery)) return null;
  const note = parseLocalText(delivery['note']);
  if (typeof delivery['available'] !== 'boolean' || !note) return null;
  return {
    cookingDate,
    cutoffAt,
    status,
    pickupPoints,
    delivery: { available: delivery['available'], note },
  };
}

function parseChef(input: unknown): Chef | null {
  if (!isRecord(input)) return null;
  const { id, sellerId, name } = input;
  if (typeof id !== 'string' || typeof sellerId !== 'string' || typeof name !== 'string') {
    return null;
  }
  return { id, sellerId, name };
}

function parseMenuItemView(input: unknown): MenuItemView | null {
  if (!isRecord(input)) return null;
  if ('chefId' in input) return null; // customers never receive chef data (D-012)
  const name = parseLocalText(input['name']);
  const description = parseLocalText(input['description']);
  const size = parseLocalText(input['size']);
  const { id, priceCents, limit, remaining, soldOut } = input;
  if (typeof id !== 'string' || !name || !description || !size) return null;
  if (!isInt(priceCents, 0, 1_000_000)) return null;
  if (limit !== undefined && !isInt(limit, 1, 10_000)) return null;
  if (remaining !== null && !isInt(remaining, 0, 10_000)) return null;
  if (typeof soldOut !== 'boolean') return null;
  return {
    id,
    name,
    description,
    size,
    priceCents,
    ...(limit !== undefined ? { limit } : {}),
    remaining,
    soldOut,
  };
}

function parseSellerMenuItemView(input: unknown): SellerMenuItemView | null {
  if (!isRecord(input)) return null;
  const { chefId, ...rest } = input;
  if (chefId !== undefined && typeof chefId !== 'string') return null;
  const item = parseMenuItemView(rest);
  return item ? { ...item, ...(chefId !== undefined ? { chefId } : {}) } : null;
}

function parseOrderingState(input: unknown): OrderingState | null {
  if (!isRecord(input)) return null;
  const { open, reason } = input;
  if (typeof open !== 'boolean') return null;
  if (reason === undefined) return { open };
  return isOneOf(['closed_by_seller', 'cutoff_passed'], reason) ? { open, reason } : null;
}

export function parseMenuResponse(input: unknown): MenuResponse | null {
  if (!isRecord(input) || 'chefs' in input) return null; // customers never receive chef data
  const seller = parseSeller(input['seller']);
  const kitchen = parseKitchen(input['kitchen']);
  const week = parseWeek(input['week']);
  const items = parseArray(input['items'], parseMenuItemView);
  const ordering = parseOrderingState(input['ordering']);
  if (!seller || !kitchen || !week || !items || !ordering) return null;
  if (items.length > MAX_MENU_ITEMS || kitchen.sellerId !== seller.id) return null;
  return { seller, kitchen, week, items, ordering };
}

export function parseSellerMenuResponse(input: unknown): SellerMenuResponse | null {
  if (!isRecord(input)) return null;
  const { chefs: rawChefs, items: rawItems, ...rest } = input;
  const chefs = parseArray(rawChefs, parseChef);
  const items = parseArray(rawItems, parseSellerMenuItemView);
  if (!chefs || !items) return null;
  // Reuse the customer parser for the shared part (it never sees the chef fields).
  const base = parseMenuResponse({ ...rest, items: [] });
  if (!base || items.length > MAX_MENU_ITEMS) return null;
  return { ...base, chefs, items };
}
