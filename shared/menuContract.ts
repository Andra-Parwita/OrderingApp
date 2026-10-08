import type { Chef, Kitchen, MenuItemView, PickupPoint, Week } from './domain';
import { MAX_MENU_ITEMS } from './limits';
import { isInt, isIsoDate, isOneOf, isRecord, parseArray, parseLocalText } from './parse';

/** GET /api/menu */
export type MenuResponse = {
  kitchen: Kitchen;
  week: Week;
  chefs: Array<Chef>;
  items: Array<MenuItemView>;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseKitchen(input: unknown): Kitchen | null {
  if (!isRecord(input)) return null;
  const tagline = parseLocalText(input['tagline']);
  const banner = input['bannerImageUrl'];
  if (typeof input['name'] !== 'string' || !tagline) return null;
  if (banner !== undefined && typeof banner !== 'string') return null;
  return {
    name: input['name'],
    tagline,
    ...(banner !== undefined ? { bannerImageUrl: banner } : {}),
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
  if (typeof input['id'] !== 'string' || typeof input['name'] !== 'string') return null;
  return { id: input['id'], name: input['name'] };
}

function parseMenuItemView(input: unknown): MenuItemView | null {
  if (!isRecord(input)) return null;
  const name = parseLocalText(input['name']);
  const description = parseLocalText(input['description']);
  const size = parseLocalText(input['size']);
  const { id, priceCents, limit, chefId, remaining, soldOut } = input;
  if (typeof id !== 'string' || !name || !description || !size) return null;
  if (!isInt(priceCents, 0, 1_000_000)) return null;
  if (limit !== undefined && !isInt(limit, 1, 10_000)) return null;
  if (chefId !== undefined && typeof chefId !== 'string') return null;
  if (remaining !== null && !isInt(remaining, 0, 10_000)) return null;
  if (typeof soldOut !== 'boolean') return null;
  return {
    id,
    name,
    description,
    size,
    priceCents,
    ...(limit !== undefined ? { limit } : {}),
    ...(chefId !== undefined ? { chefId } : {}),
    remaining,
    soldOut,
  };
}

export function parseMenuResponse(input: unknown): MenuResponse | null {
  if (!isRecord(input)) return null;
  const kitchen = parseKitchen(input['kitchen']);
  const week = parseWeek(input['week']);
  const chefs = parseArray(input['chefs'], parseChef);
  const items = parseArray(input['items'], parseMenuItemView);
  if (!kitchen || !week || !chefs || !items || items.length > MAX_MENU_ITEMS) return null;
  return { kitchen, week, chefs, items };
}
