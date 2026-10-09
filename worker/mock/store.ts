// Pure in-memory store: no Workers APIs, so unit tests and MSW reuse it.
import type { ApiErrorCode } from '../../shared/apiError';
import { diffOrder } from '../../shared/auditDiff';
import type {
  Actor,
  AuditEntry,
  Chef,
  InboxEntry,
  Kitchen,
  KitchenImages,
  KitchenSettings,
  Seller,
  MenuItem,
  MenuItemView,
  SellerMenuItemView,
  OrderingState,
  OrderLine,
  OrderStatus,
  SellerOrder,
  StaffActor,
  Week,
} from '../../shared/domain';
import { BACKUP_VERSION, type BackupFile } from '../../shared/backup';
import { ordersToCsv } from '../../shared/csv';
import { checkImageUpload, IMAGE_SLOTS, type ImageSlot } from '../../shared/imageSlots';
import { AUDIT_MAX, INBOX_MAX, MAX_CHEFS, MAX_MENU_ITEMS, MAX_SETS } from '../../shared/limits';
import type { MenuResponse, SellerMenuResponse } from '../../shared/menuContract';
import {
  applyRetention,
  shiftDays,
  summariseOrders,
  toSummary,
  type PastWeek,
  type PastWeekSummary,
} from '../../shared/pastWeeks';
import type {
  CreateItemRequest,
  ImageStyleRequest,
  SavedSet,
  SavedSetView,
  UpdateItemRequest,
  UseSetRequest,
  WeekSettingsRequest,
} from '../../shared/setupContract';
import type {
  CreateOrderRequest,
  CreateSellerOrderRequest,
  RequestedLine,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import { generateOrderCode, generateToken, type FillRandom } from '../../shared/orderCode';
import { isFinalStatus, nextStatuses } from '../../shared/status';
import { fixtureSellers, type SellerFixture } from './fixture';

type Order = SellerOrder;

export type StoreResult<T> =
  { ok: true; value: T } | { ok: false; error: ApiErrorCode; message: string };

export type StoreOptions = {
  /** Injected clock; the store never reads the real time. */
  now: () => Date;
  newId?: () => string;
  newCode?: () => string;
  newToken?: () => string;
  /** Seed of the pseudo-random source used by addSampleOrders. */
  seed?: number;
};

type InsertExtra = { status?: OrderStatus; paid?: boolean; returning?: boolean };

const SAMPLE_NAMES = ['Rina', 'Tom', 'Sari', 'Budi', 'Mei', 'Dewi', 'Arif', 'Lisa'];
const SAMPLE_NOTES = [
  'No chilli please',
  'Allergic to peanuts',
  'Pickup around 3pm',
  'Tolong dibungkus terpisah',
  'Ring the bell, the gate sticks',
];

function fail<T>(error: ApiErrorCode, message: string): StoreResult<T> {
  return { ok: false, error, message };
}

function ok<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

/** A copy of the object without one key. */
function without<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const copy = { ...source } as Partial<T>;
  delete copy[key];
  return copy as Omit<T, K>;
}

/** mulberry32: small deterministic PRNG returning [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One seller's data: kitchen, settings, menu, chefs and orders. Nothing here can see another
 * seller (D-036); the multi-seller `createStore` below holds one of these per seller.
 */
export function createSellerStore(
  options: StoreOptions,
  fixture: SellerFixture = fixtureSellers[0] as SellerFixture,
  seedOffset = 0,
) {
  const seller: Seller = { ...fixture.seller };
  const seed = (options.seed ?? 20261011) + seedOffset;
  let random = seededRandom(seed);
  const seededFill: FillRandom = (bytes) => {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
    return bytes;
  };
  let idCounter = 0;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const newCode = options.newCode ?? (() => generateOrderCode());
  const newToken = options.newToken ?? (() => generateToken());

  let kitchen: Kitchen = structuredClone(fixture.kitchen);
  let week: Week = structuredClone(fixture.week);
  let chefs: Array<Chef> = structuredClone(fixture.chefs);
  let items: Array<MenuItem> = structuredClone(fixture.items);
  let settings: KitchenSettings = structuredClone(fixture.settings);
  let orders: Array<Order> = [];
  let sets: Array<SavedSet> = [];
  let pastWeeks: Array<PastWeek> = [];
  /** Orders whose details were dropped by retention: just the token and the week (D-044). */
  let expiredOrders: Array<{ token: string; cookingDate: string }> = [];

  const nowIso = () => options.now().toISOString();
  const cutoffPassed = () => options.now().getTime() >= Date.parse(week.cutoffAt);

  function ordering(): OrderingState {
    if (!settings.orderingOpen) return { open: false, reason: 'closed_by_seller' };
    if (cutoffPassed()) return { open: false, reason: 'cutoff_passed' };
    return { open: true };
  }

  /** The error that stops a customer from placing or changing an order, if any. */
  function closedError<T>(): StoreResult<T> | null {
    const state = ordering();
    if (state.reason === 'closed_by_seller') return fail('ordering_closed', 'Ordering is closed');
    if (state.reason === 'cutoff_passed') return fail('cutoff_passed', 'Orders are closed');
    return null;
  }

  function usedPortions(itemId: string, exceptOrderId?: string): number {
    let used = 0;
    for (const order of orders) {
      if (order.id === exceptOrderId || order.status === 'cancelled') continue;
      for (const line of order.lines) if (line.itemId === itemId) used += line.qty;
    }
    return used;
  }

  function sellerView(item: MenuItem): SellerMenuItemView {
    const { soldOut: manual, ...rest } = item;
    const remaining =
      item.limit === undefined ? null : Math.max(0, item.limit - usedPortions(item.id));
    return {
      ...rest,
      remaining,
      soldOut: manual === true || remaining === 0,
      ...(manual === true ? { manualSoldOut: true } : {}),
    };
  }

  /** The customer view: the chef (D-012) and the manual flag are dropped here. */
  function view(item: MenuItem): MenuItemView {
    const copy = sellerView(item);
    delete copy.chefId;
    delete copy.manualSoldOut;
    return copy;
  }

  /** Any order that is not cancelled counts as "has orders" (D-020). */
  function hasOrders(itemId: string): boolean {
    return orders.some(
      (order) => order.status !== 'cancelled' && order.lines.some((line) => line.itemId === itemId),
    );
  }

  function images(): KitchenImages {
    return kitchen.images ?? {};
  }

  function withImages(next: KitchenImages): void {
    const rest = without(kitchen, 'images');
    kitchen = Object.keys(next).length > 0 ? { ...rest, images: next } : rest;
  }

  /** Order details older than 4 weeks are dropped here, on every read (D-027 row 6). */
  function pastNow(): Array<PastWeek> {
    const now = options.now();
    pastWeeks = pastWeeks.map((week) => {
      const kept = applyRetention(week, now);
      if (week.orders !== undefined && kept.orders === undefined) {
        for (const order of week.orders) {
          expiredOrders.push({ token: order.token, cookingDate: week.cookingDate });
        }
      }
      return kept;
    });
    return pastWeeks;
  }

  function setView(set: SavedSet): SavedSetView {
    return {
      id: set.id,
      name: set.name,
      items: structuredClone(set.items),
      imageSlots: IMAGE_SLOTS.filter((slot) => set.images[slot] !== undefined),
    };
  }

  function publicMenu(): MenuResponse {
    return {
      seller: { ...seller },
      kitchen: {
        ...kitchen,
        ...(settings.whatsappNumber ? { whatsappNumber: settings.whatsappNumber } : {}),
      },
      week,
      items: items.map(view),
      ordering: ordering(),
    };
  }

  function snapshot(item: MenuItem, qty: number): OrderLine {
    return {
      itemId: item.id,
      name: { ...item.name },
      size: { ...item.size },
      priceCents: item.priceCents,
      qty,
    };
  }

  /**
   * Checks the requested lines against the menu and the remaining portions. A line already on the
   * order (when editing) keeps its snapshot (D-020); new lines snapshot the current item.
   */
  function buildLines(
    requested: Array<RequestedLine>,
    existing: Array<OrderLine> = [],
    exceptOrderId?: string,
  ): StoreResult<Array<OrderLine>> {
    const lines: Array<OrderLine> = [];
    for (const { itemId, qty } of requested) {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item) return fail('unknown_item', `Unknown item: ${itemId}`);
      const previous = existing.find((line) => line.itemId === itemId);
      // Manually sold out: no new portions (an order may keep what it already has).
      if (item.soldOut === true && (!previous || qty > previous.qty)) {
        return fail('sold_out', `${item.name.en} is sold out`);
      }
      if (item.limit !== undefined) {
        const left = item.limit - usedPortions(itemId, exceptOrderId);
        if (left <= 0) return fail('sold_out', `${item.name.en} is sold out`);
        if (qty > left) return fail('exceeds_remaining', `Only ${left} left of ${item.name.en}`);
      }
      lines.push(previous ? { ...previous, qty } : snapshot(item, qty));
    }
    return ok(lines);
  }

  function withAudit(order: Order, entry: Omit<AuditEntry, 'at'>): Order {
    const at = nowIso();
    return {
      ...order,
      audit: [{ ...entry, at }, ...order.audit].slice(0, AUDIT_MAX),
      updatedAt: at,
    };
  }

  function withInbox(order: Order, entry: Omit<InboxEntry, 'at'>): Order {
    return { ...order, inbox: [{ ...entry, at: nowIso() }, ...order.inbox].slice(0, INBOX_MAX) };
  }

  function replace(updated: Order): Order {
    orders = orders.map((order) => (order.id === updated.id ? updated : order));
    return updated;
  }

  function uniqueCode(make: () => string): string {
    let code = make();
    while (orders.some((order) => order.code === code)) code = make();
    return code;
  }

  function insert(
    input: CreateOrderRequest | CreateSellerOrderRequest,
    lines: Array<OrderLine>,
    by: Actor,
    enteredBy: StaffActor | undefined,
    make: { id: string; code: string; token: string },
    extra: InsertExtra = {},
  ): Order {
    const at = nowIso();
    const status: OrderStatus = extra.status ?? (enteredBy ? 'confirmed' : 'ordered');
    const order: Order = {
      id: make.id,
      sellerId: seller.id,
      code: make.code,
      token: make.token,
      firstName: input.firstName,
      language: input.language,
      lines,
      fulfilment: input.fulfilment,
      ...(input.note !== undefined ? { note: input.note } : {}),
      status,
      paid: extra.paid ?? false,
      locked: false,
      waReceived: false,
      returning: extra.returning ?? false,
      changed: false,
      inbox: [{ at, kind: 'status', status }],
      ...(enteredBy ? { enteredBy } : {}),
      audit: [{ by, what: 'created', at }],
      createdAt: at,
      updatedAt: at,
    };
    orders = [...orders, order];
    return order;
  }

  function place(
    input: CreateOrderRequest | CreateSellerOrderRequest,
    by: Actor,
    enteredBy: StaffActor | undefined,
    extra: InsertExtra = {},
  ): StoreResult<Order> {
    const lines = buildLines(input.lines);
    if (!lines.ok) return lines;
    return ok(
      insert(
        input,
        lines.value,
        by,
        enteredBy,
        { id: newId(), code: uniqueCode(newCode), token: newToken() },
        extra,
      ),
    );
  }

  /** Records a customer edit: the audit diff and the "changed" flag. No-op if nothing differs. */
  function applyEdit(order: Order, next: Order): Order {
    const diff = diffOrder(order, next);
    if (!diff) return order;
    return replace(
      withAudit(
        { ...next, changed: true },
        { by: { role: 'customer', name: order.firstName }, what: 'edited', diff },
      ),
    );
  }

  /** Applies the patch fields to a copy of the order (limits checked), without any other rule. */
  function patched(order: Order, patch: UpdateOrderRequest): StoreResult<Order> {
    let next: Order = order;
    if (patch.lines) {
      const lines = buildLines(patch.lines, order.lines, order.id);
      if (!lines.ok) return lines;
      next = { ...next, lines: lines.value };
    }
    if (patch.fulfilment) next = { ...next, fulfilment: patch.fulfilment };
    if (patch.note !== undefined) {
      next = { ...next };
      if (patch.note === '') delete next.note;
      else next.note = patch.note;
    }
    return ok(next);
  }

  function findByCode(code: string): Order | undefined {
    return orders.find((candidate) => candidate.code === code);
  }

  function changeByCode(
    code: string,
    change: (order: Order) => StoreResult<Order>,
  ): StoreResult<Order> {
    const order = findByCode(code);
    if (!order) return fail('not_found', 'Order not found');
    const result = change(order);
    return result.ok ? ok(replace(result.value)) : result;
  }

  return {
    seller,

    getMenu(): MenuResponse {
      return publicMenu();
    },

    /** Seller-only: the menu with the chef grouping. */
    getSellerMenu(): SellerMenuResponse {
      return { ...publicMenu(), chefs, items: items.map(sellerView) };
    },

    getSettings(): KitchenSettings {
      return structuredClone(settings);
    },

    /** Replaces the settings; the caller has already validated and normalised them. */
    setSettings(next: KitchenSettings): KitchenSettings {
      settings = structuredClone(next);
      return structuredClone(settings);
    },

    // ---- Week (stage 6.1) ----

    getWeek(): Week {
      return structuredClone(week);
    },

    /** One pickup point for now (D-008); the ordering switch stays in the settings. */
    updateWeek(input: WeekSettingsRequest): Week {
      const point = input.pickupPoints[0];
      week = {
        ...week,
        cookingDate: input.cookingDate,
        cutoffAt: input.cutoffAt,
        pickupPoints: [
          {
            id: point.id ?? week.pickupPoints[0]?.id ?? 'main',
            place: point.place,
            directions: { ...point.directions },
            window: { ...point.window },
          },
        ],
        delivery: { available: input.delivery.available, note: { ...input.delivery.note } },
      };
      return structuredClone(week);
    },

    publishWeek(): StoreResult<Week> {
      if (items.length === 0) return fail('no_items', 'Add at least one item first');
      week = { ...week, status: 'published' };
      return ok(structuredClone(week));
    },

    unpublishWeek(): Week {
      week = { ...week, status: 'draft' };
      return structuredClone(week);
    },

    /**
     * Archives the week (totals kept for good, orders for 4 weeks) and starts the next draft
     * week 7 days later with the same items. Orders leave the live list.
     */
    closeWeek(): { week: Week; closed: PastWeekSummary } {
      const closed: PastWeek = {
        id: newId(),
        cookingDate: week.cookingDate,
        closedAt: nowIso(),
        totals: summariseOrders(orders),
        orders: structuredClone(orders),
      };
      pastWeeks = [closed, ...pastWeeks];
      orders = [];
      week = {
        ...week,
        cookingDate: shiftDays(week.cookingDate, 7),
        cutoffAt: shiftDays(week.cutoffAt, 7),
        status: 'draft',
      };
      items = items.map((item) => without(item, 'soldOut'));
      const kept = pastNow().find((candidate) => candidate.id === closed.id) as PastWeek;
      return { week: structuredClone(week), closed: toSummary(kept) };
    },

    listPastWeeks(): Array<PastWeekSummary> {
      return pastNow().map(toSummary);
    },

    /**
     * An order of a closed week by its private token (D-044): the order while its details are
     * kept, then just the week's date, then nothing.
     */
    getArchivedByToken(
      token: string,
    ):
      | { order: Order; cookingDate: string }
      | { order?: undefined; cookingDate: string }
      | undefined {
      for (const past of pastNow()) {
        const order = past.orders?.find((candidate) => candidate.token === token);
        if (order) return { order: structuredClone(order), cookingDate: past.cookingDate };
      }
      const gone = expiredOrders.find((entry) => entry.token === token);
      return gone ? { cookingDate: gone.cookingDate } : undefined;
    },

    getPastWeek(id: string): PastWeek | undefined {
      const found = pastNow().find((week) => week.id === id);
      return found ? structuredClone(found) : undefined;
    },

    // ---- Menu items (D-020: edits only touch new orders; snapshots live on the order lines) ----

    addItem(input: CreateItemRequest): StoreResult<SellerMenuItemView> {
      if (items.length >= MAX_MENU_ITEMS) {
        return fail('limit_reached', `At most ${String(MAX_MENU_ITEMS)} items`);
      }
      if (input.chefId !== undefined && !chefs.some((chef) => chef.id === input.chefId)) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const item: MenuItem = {
        id: newId(),
        name: { ...input.name },
        description: { ...(input.description ?? { en: '', id: '' }) },
        size: { ...(input.size ?? { en: '', id: '' }) },
        priceCents: input.priceCents,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.chefId !== undefined ? { chefId: input.chefId } : {}),
      };
      items = [...items, item];
      return ok(sellerView(item));
    },

    patchItem(id: string, patch: UpdateItemRequest): StoreResult<SellerMenuItemView> {
      const current = items.find((item) => item.id === id);
      if (!current) return fail('not_found', 'Item not found');
      if (typeof patch.chefId === 'string' && !chefs.some((chef) => chef.id === patch.chefId)) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const next: MenuItem = { ...current };
      if (patch.name) next.name = { ...patch.name };
      if (patch.description) next.description = { ...patch.description };
      if (patch.size) next.size = { ...patch.size };
      if (patch.priceCents !== undefined) next.priceCents = patch.priceCents;
      if (patch.limit === null) delete next.limit;
      else if (patch.limit !== undefined) next.limit = patch.limit;
      if (patch.chefId === null) delete next.chefId;
      else if (patch.chefId !== undefined) next.chefId = patch.chefId;
      if (patch.soldOut === false) delete next.soldOut;
      else if (patch.soldOut === true) next.soldOut = true;
      items = items.map((item) => (item.id === id ? next : item));
      return ok(sellerView(next));
    },

    /** `ids` must list every item once. */
    reorderItems(ids: ReadonlyArray<string>): StoreResult<Array<SellerMenuItemView>> {
      const same = ids.length === items.length && items.every((item) => ids.includes(item.id));
      if (!same) return fail('invalid_request', 'List every item once');
      items = ids.map((id) => items.find((item) => item.id === id) as MenuItem);
      return ok(items.map(sellerView));
    },

    /** An item with a live (not cancelled) order can't be deleted; mark it sold out instead. */
    removeItem(id: string): StoreResult<true> {
      if (!items.some((item) => item.id === id)) return fail('not_found', 'Item not found');
      if (hasOrders(id)) return fail('item_has_orders', 'This item has orders; mark it sold out');
      items = items.filter((item) => item.id !== id);
      return ok(true);
    },

    // ---- Chefs ----

    listChefs(): Array<Chef> {
      return structuredClone(chefs);
    },

    addChef(name: string): StoreResult<Chef> {
      if (chefs.length >= MAX_CHEFS) return fail('limit_reached', 'Too many chefs');
      const chef: Chef = { id: newId(), sellerId: seller.id, name };
      chefs = [...chefs, chef];
      return ok({ ...chef });
    },

    renameChef(id: string, name: string): StoreResult<Chef> {
      const chef = chefs.find((candidate) => candidate.id === id);
      if (!chef) return fail('not_found', 'Chef not found');
      const renamed = { ...chef, name };
      chefs = chefs.map((candidate) => (candidate.id === id ? renamed : candidate));
      return ok({ ...renamed });
    },

    /** Deleting a chef unassigns their items (this week and in saved sets). */
    removeChef(id: string): StoreResult<true> {
      if (!chefs.some((chef) => chef.id === id)) return fail('not_found', 'Chef not found');
      const unassign = <T extends { chefId?: string }>(item: T): T =>
        item.chefId === id ? (without(item, 'chefId') as T) : item;
      chefs = chefs.filter((chef) => chef.id !== id);
      items = items.map(unassign);
      sets = sets.map((set) => ({ ...set, items: set.items.map(unassign) }));
      return ok(true);
    },

    // ---- Saved sets ----

    listSets(): Array<SavedSetView> {
      return sets.map(setView);
    },

    /** Saves the week's items and the current images. A 6th set needs `replaceSetId`. */
    saveSet(name: string, replaceSetId?: string): StoreResult<SavedSetView> {
      if (items.length === 0) return fail('no_items', 'Add at least one item first');
      const target =
        replaceSetId === undefined ? undefined : sets.find((set) => set.id === replaceSetId);
      if (replaceSetId !== undefined && !target) return fail('not_found', 'Set not found');
      if (!target && sets.length >= MAX_SETS) {
        return fail('limit_reached', `At most ${String(MAX_SETS)} sets; replace one`);
      }
      const saved: SavedSet = {
        id: target?.id ?? newId(),
        name,
        items: items.map((item) => structuredClone(without(without(item, 'id'), 'soldOut'))),
        images: structuredClone(images()),
      };
      sets = target ? sets.map((set) => (set.id === saved.id ? saved : set)) : [...sets, saved];
      return ok(setView(saved));
    },

    renameSet(id: string, name: string): StoreResult<SavedSetView> {
      const set = sets.find((candidate) => candidate.id === id);
      if (!set) return fail('not_found', 'Set not found');
      const renamed = { ...set, name };
      sets = sets.map((candidate) => (candidate.id === id ? renamed : candidate));
      return ok(setView(renamed));
    },

    removeSet(id: string): StoreResult<true> {
      if (!sets.some((set) => set.id === id)) return fail('not_found', 'Set not found');
      sets = sets.filter((set) => set.id !== id);
      return ok(true);
    },

    /**
     * Replaces a draft week's items with the set's. Needs `confirm` when the week has items;
     * refused while a current item has orders (D-020).
     */
    useSet(id: string, request: UseSetRequest): StoreResult<Array<SellerMenuItemView>> {
      const set = sets.find((candidate) => candidate.id === id);
      if (!set) return fail('not_found', 'Set not found');
      if (week.status !== 'draft') return fail('week_not_draft', 'Unpublish the week first');
      if (items.length > 0 && request.confirm !== true) {
        return fail('confirm_required', 'This replaces the items of the week');
      }
      if (items.some((item) => hasOrders(item.id))) {
        return fail('item_has_orders', 'Some items already have orders');
      }
      items = set.items.map((item) => {
        const copy: MenuItem = { ...structuredClone(item), id: newId() };
        const known = copy.chefId === undefined || chefs.some((chef) => chef.id === copy.chefId);
        return known ? copy : without(copy, 'chefId');
      });
      if (request.applyImages === true) {
        const alt = images().alt;
        withImages({ ...structuredClone(set.images), ...(alt ? { alt } : {}) });
      }
      return ok(items.map(sellerView));
    },

    // ---- Images (D-038, D-040): data URLs kept in memory ----

    getImages(): KitchenImages {
      return structuredClone(images());
    },

    setImage(slot: ImageSlot, dataUrl: unknown): StoreResult<KitchenImages> {
      const check = checkImageUpload(slot, dataUrl);
      if (!check.ok) {
        const message = {
          image_type: 'Use a jpeg, png or webp image',
          image_too_big: 'The image is over 600 KB',
          image_ratio: 'The image has the wrong shape for this place',
        }[check.error];
        return fail(check.error, message);
      }
      withImages({ ...images(), [slot]: dataUrl as string });
      return ok(structuredClone(images()));
    },

    removeImage(slot: ImageSlot): KitchenImages {
      withImages(without(images(), slot));
      return structuredClone(images());
    },

    /** Banner colour and alt text. */
    setImageStyle(style: ImageStyleRequest): KitchenImages {
      const current = images();
      const slots = without(without(current, 'bannerBackground'), 'alt');
      const colour =
        style.bannerBackground === undefined ? current.bannerBackground : style.bannerBackground;
      const alt = style.alt === undefined ? current.alt : style.alt;
      const hasAlt = alt !== undefined && (alt.en !== '' || alt.id !== '');
      withImages({
        ...slots,
        ...(colour ? { bannerBackground: colour } : {}),
        ...(hasAlt ? { alt } : {}),
      });
      return structuredClone(images());
    },

    // ---- Backup and CSV ----

    exportBackup(): BackupFile {
      return structuredClone({
        version: BACKUP_VERSION,
        exportedAt: nowIso(),
        seller: { slug: seller.slug, name: seller.name },
        kitchen,
        settings,
        week,
        items,
        chefs,
        sets,
        orders,
        pastWeeks: pastNow(),
      });
    },

    /** Replaces this seller's data with an already validated backup; other sellers are not touched. */
    restoreBackup(file: BackupFile): void {
      const copy = structuredClone(file);
      kitchen = { ...copy.kitchen, sellerId: seller.id };
      settings = copy.settings;
      week = copy.week;
      chefs = copy.chefs.map((chef) => ({ ...chef, sellerId: seller.id }));
      const known = new Set(chefs.map((chef) => chef.id));
      const fixChef = <T extends { chefId?: string }>(item: T): T =>
        item.chefId === undefined || known.has(item.chefId) ? item : (without(item, 'chefId') as T);
      items = copy.items.map(fixChef);
      sets = copy.sets.map((set) => ({ ...set, items: set.items.map(fixChef) }));
      orders = copy.orders.map((order) => ({ ...order, sellerId: seller.id }));
      expiredOrders = [];
      pastWeeks = copy.pastWeeks.map((past) => ({
        ...past,
        ...(past.orders
          ? { orders: past.orders.map((order) => ({ ...order, sellerId: seller.id })) }
          : {}),
      }));
      pastNow();
    },

    /** Every order of the week, oldest first, as CSV with a BOM for Excel. */
    ordersCsv(): string {
      return ordersToCsv(orders);
    },

    /** Customer order: refused for a draft week, when closed by the seller, or after the cut-off. */
    createOrder(input: CreateOrderRequest): StoreResult<Order> {
      if (week.status !== 'published') return fail('week_not_published', 'The menu is not open');
      const closed = closedError<Order>();
      if (closed) return closed;
      return place(input, { role: 'customer', name: input.firstName }, undefined, {
        returning: input.returning ?? false,
      });
    },

    /**
     * Seller/chef-entered order: starts confirmed unless `confirmNow` is false, `paid` defaults
     * to false (D-027). Allowed after the cut-off (D-024).
     */
    createSellerOrder(input: CreateSellerOrderRequest, actor: StaffActor): StoreResult<Order> {
      return place(input, actor, actor, {
        status: input.confirmNow === false ? 'ordered' : 'confirmed',
        paid: input.paid ?? false,
      });
    },

    getByToken(token: string): Order | undefined {
      return orders.find((order) => order.token === token);
    },

    getByCode(code: string): Order | undefined {
      return findByCode(code);
    },

    /** Newest first. */
    listOrders(): Array<Order> {
      return [...orders].reverse();
    },

    /** Customer change: not when closed, locked or final. */
    updateOrder(token: string, patch: UpdateOrderRequest): StoreResult<Order> {
      const order = orders.find((candidate) => candidate.token === token);
      if (!order) return fail('not_found', 'Order not found');
      const closed = closedError<Order>();
      if (closed) return closed;
      if (order.locked) return fail('order_locked', 'The seller has locked this order');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      const next = patched(order, patch);
      return next.ok ? ok(applyEdit(order, next.value)) : next;
    },

    /** Customer cancel (a change, so refused when closed or locked). */
    cancelOrder(token: string): StoreResult<Order> {
      const order = orders.find((candidate) => candidate.token === token);
      if (!order) return fail('not_found', 'Order not found');
      const closed = closedError<Order>();
      if (closed) return closed;
      if (order.locked) return fail('order_locked', 'The seller has locked this order');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      const cancelled = withInbox(
        { ...order, status: 'cancelled' },
        { kind: 'status', status: 'cancelled' },
      );
      return ok(
        replace(
          withAudit(cancelled, {
            by: { role: 'customer', name: order.firstName },
            what: 'status',
            detail: 'cancelled',
          }),
        ),
      );
    },

    /** Moves the order on, tells the customer, and clears the "changed" flag. */
    setStatus(code: string, to: OrderStatus, actor: StaffActor): StoreResult<Order> {
      return changeByCode(code, (order) => {
        if (!nextStatuses(order).includes(to)) {
          return fail('invalid_status', `Cannot move from ${order.status} to ${to}`);
        }
        const moved = withInbox(
          { ...order, status: to, changed: false },
          { kind: 'status', status: to },
        );
        return ok(withAudit(moved, { by: actor, what: 'status', detail: to }));
      });
    },

    setPaid(code: string, paid: boolean, actor: StaffActor): StoreResult<Order> {
      return changeByCode(code, (order) =>
        ok(
          withAudit(
            { ...order, paid },
            { by: actor, what: 'paid', detail: paid ? 'paid' : 'unpaid' },
          ),
        ),
      );
    },

    /** Seller lock: the customer can't change or cancel; the seller still can. */
    setLocked(code: string, locked: boolean): StoreResult<Order> {
      return changeByCode(code, (order) => ok({ ...order, locked, updatedAt: nowIso() }));
    },

    setWaReceived(code: string, received: boolean): StoreResult<Order> {
      return changeByCode(code, (order) => ok({ ...order, waReceived: received }));
    },

    /** Adds a nudge to the customer's inbox; the text key differs for returning customers. */
    nudge(code: string): StoreResult<Order> {
      return changeByCode(code, (order) => {
        if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
        const textKey = order.returning ? 'nudgeReturning' : 'nudge';
        return ok({ ...withInbox(order, { kind: 'nudge', textKey }), updatedAt: nowIso() });
      });
    },

    /** The seller has seen the customer's change. */
    markSeen(code: string): StoreResult<Order> {
      return changeByCode(code, (order) => ok({ ...order, changed: false }));
    },

    /** Edits a menu item; existing orders keep their snapshots (D-020). */
    updateItem(id: string, patch: Partial<Omit<MenuItem, 'id'>>): boolean {
      const index = items.findIndex((item) => item.id === id);
      const current = items[index];
      if (!current) return false;
      items = items.map((item, i) => (i === index ? { ...current, ...patch } : item));
      return true;
    },

    setWeek(patch: Partial<Week>): void {
      week = { ...week, ...patch };
    },

    /**
     * Deterministic sample orders (varied returning, changed, locked, notes, fulfilment);
     * respects portion limits, ignores the cut-off. Returns the count added.
     */
    addSampleOrders(count: number): number {
      let added = 0;
      for (let n = 0; n < count; n++) {
        const picks = items.filter(() => random() < 0.4);
        if (picks.length === 0) picks.push(items[Math.floor(random() * items.length)] as MenuItem);
        const requested: Array<RequestedLine> = [];
        for (const item of picks.slice(0, 3)) {
          const left = item.limit === undefined ? 3 : item.limit - usedPortions(item.id);
          const qty = Math.min(1 + Math.floor(random() * 3), left);
          if (qty >= 1) requested.push({ itemId: item.id, qty });
        }
        if (requested.length === 0) continue;
        const lines = buildLines(requested);
        if (!lines.ok) continue;
        const firstName = SAMPLE_NAMES[Math.floor(random() * SAMPLE_NAMES.length)] as string;
        const note =
          random() < 0.3
            ? (SAMPLE_NOTES[Math.floor(random() * SAMPLE_NOTES.length)] as string)
            : undefined;
        const input: CreateOrderRequest = {
          firstName,
          language: random() < 0.5 ? 'en' : 'id',
          lines: requested,
          fulfilment: random() < 0.6 ? 'pickup' : 'delivery',
          ...(note !== undefined ? { note } : {}),
        };
        const code = uniqueCode(() => generateOrderCode(seededFill));
        const order = insert(
          input,
          lines.value,
          { role: 'customer', name: firstName },
          undefined,
          {
            id: `sample-${seller.slug}-${String(++idCounter)}`,
            code,
            token: generateToken(seededFill),
          },
          { returning: random() < 0.3 },
        );
        let current = order;
        if (random() < 0.4) {
          current = replace(
            withInbox({ ...current, status: 'confirmed' }, { kind: 'status', status: 'confirmed' }),
          );
        }
        if (random() < 0.25) current = replace({ ...current, waReceived: true });
        if (random() < 0.2) {
          // A customer edit after placing: flip fulfilment, change the note, and add an unlimited item.
          const extra = items.find(
            (item) =>
              item.limit === undefined && !current.lines.some((line) => line.itemId === item.id),
          );
          const edit = patched(current, {
            fulfilment: current.fulfilment === 'pickup' ? 'delivery' : 'pickup',
            note: 'Changed my mind, thanks',
            ...(extra ? { lines: [...current.lines, { itemId: extra.id, qty: 1 }] } : {}),
          });
          if (edit.ok) current = applyEdit(current, edit.value);
        }
        if (random() < 0.15) current = replace({ ...current, locked: true });
        added++;
      }
      return added;
    },

    reset(): void {
      random = seededRandom(seed);
      idCounter = 0;
      kitchen = structuredClone(fixture.kitchen);
      week = structuredClone(fixture.week);
      chefs = structuredClone(fixture.chefs);
      items = structuredClone(fixture.items);
      settings = structuredClone(fixture.settings);
      orders = [];
      sets = [];
      pastWeeks = [];
      expiredOrders = [];
    },
  };
}

export type SellerStore = ReturnType<typeof createSellerStore>;

export type TokenLookup =
  | { kind: 'live'; store: SellerStore; order: SellerOrder }
  | { kind: 'archived'; store: SellerStore; order: SellerOrder; cookingDate: string }
  | { kind: 'expired'; store: SellerStore; cookingDate: string };

/**
 * All sellers of the mock. Seller endpoints get one seller's store by slug; only the global
 * customer endpoints (by order token) look across sellers, and they get the owning seller back.
 */
export function createStore(options: StoreOptions) {
  const stores = fixtureSellers.map((fixture, index) => createSellerStore(options, fixture, index));

  return {
    sellers(): Array<Seller> {
      return stores.map((store) => ({ ...store.seller }));
    },

    /** Undefined for an unknown slug. */
    seller(slug: string): SellerStore | undefined {
      return stores.find((store) => store.seller.slug === slug);
    },

    /** Tokens are globally unique: the order knows its seller. */
    findByToken(token: string): { store: SellerStore; order: SellerOrder } | undefined {
      for (const store of stores) {
        const order = store.getByToken(token);
        if (order) return { store, order };
      }
      return undefined;
    },

    /**
     * Like `findByToken`, but also looks in each seller's closed weeks (D-044). A live order wins;
     * an archived one carries its week's date; an expired one only the date.
     */
    lookupByToken(token: string): TokenLookup | undefined {
      for (const store of stores) {
        const order = store.getByToken(token);
        if (order) return { kind: 'live', store, order };
      }
      for (const store of stores) {
        const hit = store.getArchivedByToken(token);
        if (!hit) continue;
        return hit.order
          ? { kind: 'archived', store, order: hit.order, cookingDate: hit.cookingDate }
          : { kind: 'expired', store, cookingDate: hit.cookingDate };
      }
      return undefined;
    },

    /** Resets every seller in place (existing `seller()` references stay valid). */
    reset(): void {
      for (const store of stores) store.reset();
    },
  };
}

export type MockStore = ReturnType<typeof createStore>;
