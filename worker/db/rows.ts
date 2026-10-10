// Table rows (snake_case, as D1 returns them) and their mapping to the domain types in shared/.
import type {
  AuditDiff,
  AuditEntry,
  Chef,
  InboxEntry,
  Kitchen,
  KitchenImages,
  KitchenSettings,
  MenuItem,
  OrderLine,
  PickupPoint,
  SellerOrder,
  Week,
} from '../../shared/domain';
import { IMAGE_SLOTS, type ImageSlot } from '../../shared/imageSlots';
import type { Dish, Menu, MenuState, Preferences, ThemeName } from '../../shared/menusContract';
import type { SavedSetItem } from '../../shared/setupContract';

export type KitchenRow = {
  name: string;
  tagline_en: string;
  tagline_id: string;
  banner_image_url: string | null;
  banner_background: string | null;
  image_alt_en: string;
  image_alt_id: string;
};
export type ImageRow = { slot: ImageSlot; ref: string };
export type SettingsRow = {
  whatsapp_number: string | null;
  post_greeting_en: string;
  post_greeting_id: string;
  post_closing_en: string;
  post_closing_id: string;
  theme: ThemeName;
  default_cutoff_days: number;
  default_cutoff_time: string;
  default_delivery: number;
  default_delivery_note_en: string;
  default_delivery_note_id: string;
};
export type MenuRow = {
  id: string;
  state: MenuState;
  cooking_date: string;
  cutoff_at: string;
  delivery_available: number;
  delivery_note_en: string;
  delivery_note_id: string;
  picture_ref: string | null;
  wizard_step: number;
  taking_orders: number;
  published_at: string | null;
  finished_at: string | null;
};
/** A place the menu uses: `window_*` are the override, NULL when the place's usual time applies. */
export type MenuPlaceRow = {
  place_id: string;
  window_start: string | null;
  window_end: string | null;
};
export type DishRow = {
  id: string;
  name_en: string;
  name_id: string;
  description_en: string;
  description_id: string;
  size_en: string;
  size_id: string;
  price_cents: number;
  portion_limit: number | null;
  chef_id: string | null;
  last_used_at: string | null;
};
export type PickupRow = {
  id: string;
  place: string;
  directions_en: string;
  directions_id: string;
  window_start: string;
  window_end: string;
};
export type ItemRow = {
  id: string;
  position: number;
  name_en: string;
  name_id: string;
  description_en: string;
  description_id: string;
  size_en: string;
  size_id: string;
  price_cents: number;
  portion_limit: number | null;
  chef_id: string | null;
  sold_out: number;
  dish_id: string | null;
};
export type ChefRow = { id: string; name: string };
export type SetRow = {
  id: string;
  name: string;
  times_used: number;
  banner_background: string | null;
  image_alt_en: string;
  image_alt_id: string;
};
export type SetDishRow = { set_id: string; dish_id: string };
export type SetImageRow = { set_id: string; slot: ImageSlot; ref: string };

export type OrderRow = {
  id: string;
  seller_id: string;
  code: string;
  token: string;
  past_week_id: string | null;
  first_name: string;
  language: 'en' | 'id';
  fulfilment: 'pickup' | 'delivery';
  note: string | null;
  status: SellerOrder['status'];
  paid: number;
  locked: number;
  wa_received: number;
  is_returning: number;
  changed: number;
  entered_by_role: 'seller' | 'chef' | null;
  entered_by_name: string | null;
  packed: number;
  collected_at: string | null;
  collected_by: 'customer' | 'seller' | null;
  pickup_place_id: string | null;
  created_at: string;
  updated_at: string;
};
export type LineRow = {
  ticked: number;
  order_id: string;
  item_id: string;
  name_en: string;
  name_id: string;
  size_en: string;
  size_id: string;
  price_cents: number;
  qty: number;
};
export type AuditRow = {
  order_id: string;
  by_role: AuditEntry['by']['role'];
  by_name: string;
  what: AuditEntry['what'];
  detail: string | null;
  diff_json: string | null;
  at: string;
};
export type InboxRow = {
  order_id: string;
  at: string;
  kind: InboxEntry['kind'];
  status: InboxEntry['status'] | null;
  text_key: string | null;
  text: string | null;
  minutes: number | null;
};

const text = (en: string, id: string) => ({ en, id });

/** The slots, colour and alt text of one kitchen (or saved set) as KitchenImages. */
export function imagesOf(
  refs: ReadonlyArray<{ slot: ImageSlot; ref: string }>,
  colour: string | null,
  altEn: string,
  altId: string,
): KitchenImages {
  const images: KitchenImages = {};
  for (const slot of IMAGE_SLOTS) {
    const found = refs.find((row) => row.slot === slot);
    if (found) images[slot] = found.ref;
  }
  if (colour) images.bannerBackground = colour;
  if (altEn !== '' || altId !== '') images.alt = text(altEn, altId);
  return images;
}

export function kitchenOf(
  sellerId: string,
  row: KitchenRow,
  refs: ReadonlyArray<ImageRow>,
): Kitchen {
  const images = imagesOf(refs, row.banner_background, row.image_alt_en, row.image_alt_id);
  return {
    sellerId,
    name: row.name,
    tagline: text(row.tagline_en, row.tagline_id),
    ...(row.banner_image_url !== null ? { bannerImageUrl: row.banner_image_url } : {}),
    ...(Object.keys(images).length > 0 ? { images } : {}),
  };
}

/** `takingOrders` lives on the menu now; the settings keep their old shape. */
export function settingsOf(row: SettingsRow, takingOrders: boolean): KitchenSettings {
  return {
    ...(row.whatsapp_number !== null ? { whatsappNumber: row.whatsapp_number } : {}),
    postGreeting: text(row.post_greeting_en, row.post_greeting_id),
    postClosing: text(row.post_closing_en, row.post_closing_id),
    orderingOpen: takingOrders,
  };
}

export function preferencesOf(row: SettingsRow): Preferences {
  return {
    theme: row.theme,
    menuDefaults: {
      cutoffDaysBefore: row.default_cutoff_days,
      cutoffTime: row.default_cutoff_time,
      delivery: {
        available: row.default_delivery === 1,
        note: text(row.default_delivery_note_en, row.default_delivery_note_id),
      },
    },
  };
}

export function menuOf(row: MenuRow, uses: ReadonlyArray<MenuPlaceRow>): Menu {
  return {
    id: row.id,
    state: row.state,
    cookingDate: row.cooking_date,
    cutoffAt: row.cutoff_at,
    delivery: {
      available: row.delivery_available === 1,
      note: text(row.delivery_note_en, row.delivery_note_id),
    },
    ...(row.picture_ref !== null ? { pictureRef: row.picture_ref } : {}),
    wizardStep: row.wizard_step,
    takingOrders: row.taking_orders === 1,
    placeUses: uses.map((use) => ({
      placeId: use.place_id,
      ...(use.window_start !== null && use.window_end !== null
        ? { window: { start: use.window_start, end: use.window_end } }
        : {}),
    })),
    ...(row.published_at !== null ? { publishedAt: row.published_at } : {}),
    ...(row.finished_at !== null ? { finishedAt: row.finished_at } : {}),
  };
}

export function dishOf(row: DishRow): Dish {
  return {
    id: row.id,
    name: text(row.name_en, row.name_id),
    description: text(row.description_en, row.description_id),
    size: text(row.size_en, row.size_id),
    priceCents: row.price_cents,
    ...(row.portion_limit !== null ? { limit: row.portion_limit } : {}),
    ...(row.chef_id !== null ? { chefId: row.chef_id } : {}),
    ...(row.last_used_at !== null ? { lastUsedAt: row.last_used_at } : {}),
  };
}

/** plan 001: the legacy week shape, adapted from the menu, until stage 7. */
export function weekOf(row: MenuRow, points: ReadonlyArray<PickupRow>): Week {
  return {
    cookingDate: row.cooking_date,
    cutoffAt: row.cutoff_at,
    // plan 001: legacy shape until stage 7 (live = published; not published and finished = draft)
    status: row.state === 'live' ? 'published' : 'draft',
    pickupPoints: points.map(pickupOf),
    delivery: {
      available: row.delivery_available === 1,
      note: text(row.delivery_note_en, row.delivery_note_id),
    },
  };
}

export function pickupOf(point: PickupRow): PickupPoint {
  return {
    id: point.id,
    place: point.place,
    directions: text(point.directions_en, point.directions_id),
    window: { start: point.window_start, end: point.window_end },
  };
}

export function itemOf(row: ItemRow): MenuItem {
  return {
    id: row.id,
    name: text(row.name_en, row.name_id),
    description: text(row.description_en, row.description_id),
    size: text(row.size_en, row.size_id),
    priceCents: row.price_cents,
    ...(row.portion_limit !== null ? { limit: row.portion_limit } : {}),
    ...(row.chef_id !== null ? { chefId: row.chef_id } : {}),
    ...(row.sold_out === 1 ? { soldOut: true as const } : {}),
  };
}

/** plan 001: a library dish as the legacy saved-set item, until stage 7. */
export function setItemOf(row: DishRow): SavedSetItem {
  return {
    name: text(row.name_en, row.name_id),
    description: text(row.description_en, row.description_id),
    size: text(row.size_en, row.size_id),
    priceCents: row.price_cents,
    ...(row.portion_limit !== null ? { limit: row.portion_limit } : {}),
    ...(row.chef_id !== null ? { chefId: row.chef_id } : {}),
  };
}

export function chefOf(sellerId: string, row: ChefRow): Chef {
  return { id: row.id, sellerId, name: row.name };
}

/** Assembles full orders from their rows. Audit and inbox rows must come newest first. */
export function ordersOf(
  rows: ReadonlyArray<OrderRow>,
  lines: ReadonlyArray<LineRow>,
  audit: ReadonlyArray<AuditRow>,
  inbox: ReadonlyArray<InboxRow>,
): Array<SellerOrder> {
  const group = <T extends { order_id: string }>(list: ReadonlyArray<T>) => {
    const map = new Map<string, Array<T>>();
    for (const row of list) {
      const bucket = map.get(row.order_id);
      if (bucket) bucket.push(row);
      else map.set(row.order_id, [row]);
    }
    return map;
  };
  const linesBy = group(lines);
  const auditBy = group(audit);
  const inboxBy = group(inbox);
  return rows.map((row) => ({
    id: row.id,
    sellerId: row.seller_id,
    code: row.code,
    token: row.token,
    firstName: row.first_name,
    language: row.language,
    lines: (linesBy.get(row.id) ?? []).map((line): OrderLine => ({
      itemId: line.item_id,
      name: text(line.name_en, line.name_id),
      size: text(line.size_en, line.size_id),
      priceCents: line.price_cents,
      qty: line.qty,
      ...(line.ticked === 1 ? { ticked: true } : {}),
    })),
    fulfilment: row.fulfilment,
    ...(row.note !== null ? { note: row.note } : {}),
    status: row.status,
    paid: row.paid === 1,
    locked: row.locked === 1,
    waReceived: row.wa_received === 1,
    returning: row.is_returning === 1,
    changed: row.changed === 1,
    inbox: (inboxBy.get(row.id) ?? []).map((entry): InboxEntry => ({
      at: entry.at,
      kind: entry.kind,
      ...(entry.status !== null ? { status: entry.status } : {}),
      ...(entry.text_key !== null ? { textKey: entry.text_key } : {}),
      ...(entry.text !== null ? { text: entry.text } : {}),
      ...(entry.minutes !== null ? { minutes: entry.minutes } : {}),
    })),
    ...(row.entered_by_role !== null && row.entered_by_name !== null
      ? { enteredBy: { role: row.entered_by_role, name: row.entered_by_name } }
      : {}),
    audit: (auditBy.get(row.id) ?? []).map((entry): AuditEntry => ({
      by: { role: entry.by_role, name: entry.by_name },
      what: entry.what,
      ...(entry.detail !== null ? { detail: entry.detail } : {}),
      ...(entry.diff_json !== null ? { diff: JSON.parse(entry.diff_json) as AuditDiff } : {}),
      at: entry.at,
    })),
    ...(row.pickup_place_id !== null ? { pickupPlaceId: row.pickup_place_id } : {}),
    ...(row.packed === 1 ? { packed: true } : {}),
    ...(row.collected_at !== null && row.collected_by !== null
      ? { collectedAt: row.collected_at, collectedBy: row.collected_by }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
