// One seller's data on D1. The business rules are ported from the retired in-memory store (D-047) and every
// query filters by `seller_id` (D-036). Rules run in TypeScript on rows read from D1; each
// operation that writes several rows sends them as one batch, which D1 runs as one transaction.
import type { ApiErrorCode } from '../../shared/apiError';
import { diffOrder } from '../../shared/auditDiff';
import { BACKUP_VERSION, type BackupFile } from '../../shared/backup';
import { ordersToCsv } from '../../shared/csv';
import type {
  Actor,
  AuditEntry,
  Chef,
  InboxEntry,
  Kitchen,
  KitchenImages,
  KitchenSettings,
  MenuItem,
  MenuItemView,
  OrderingState,
  OrderLine,
  OrderStatus,
  Seller,
  SellerMenuItemView,
  SellerOrder,
  StaffActor,
  Week,
} from '../../shared/domain';
import { checkImageUpload, IMAGE_SLOTS, type ImageSlot } from '../../shared/imageSlots';
import { AUDIT_MAX, INBOX_MAX, MAX_CHEFS, MAX_MENU_ITEMS, MAX_SETS } from '../../shared/limits';
import type { MenuResponse, SellerMenuResponse } from '../../shared/menuContract';
import type {
  CreateOrderRequest,
  CreateSellerOrderRequest,
  RequestedLine,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import {
  generateOrderCode,
  generateToken,
  parseOrderCode,
  type FillRandom,
} from '../../shared/orderCode';
import {
  keepsOrderDetails,
  shiftDays,
  summariseOrders,
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
import { isFinalStatus, nextStatuses } from '../../shared/status';
import {
  statusOfTemplate,
  type SendUpdatesRequest,
  type UpdateResult,
} from '../../shared/updateContract';
import type { SellerRepository, StoreResult } from '../repo/Repository';
import { marks, type Db, type D1Statement } from './d1';
import {
  changeStatements,
  insertOrderStatements,
  readLiveOrder,
  readOrders,
  type OrderChange,
} from './orders';
import { dropExpiredDetails } from './retention';
import {
  chefOf,
  imagesOf,
  itemOf,
  kitchenOf,
  setItemOf,
  settingsOf,
  weekOf,
  type ChefRow,
  type ImageRow,
  type ItemRow,
  type KitchenRow,
  type PickupRow,
  type SetImageRow,
  type SetItemRow,
  type SetRow,
  type SettingsRow,
  type WeekRow,
} from './rows';
import {
  chefStatement,
  itemStatement,
  kitchenStatements,
  pickupStatement,
  setStatements,
  settingsStatement,
  weekStatements,
} from './write';

/** What a seller repository needs from the repository that creates it. */
export type Deps = {
  db: Db;
  now: () => Date;
  newId: () => string;
  newCode: () => string;
  newToken: () => string;
  seed: number;
  /** Per seller: the deterministic source behind the dev sample orders. */
  samples: Map<string, SampleState>;
};
export type SampleState = { random: () => number; fill: FillRandom; counter: number };

const SAMPLE_NAMES = ['Rina', 'Tom', 'Sari', 'Budi', 'Mei', 'Dewi', 'Arif', 'Lisa'];
const SAMPLE_NOTES = [
  'No chilli please',
  'Allergic to peanuts',
  'Pickup around 3pm',
  'Tolong dibungkus terpisah',
  'Ring the bell, the gate sticks',
];

/** mulberry32: small deterministic PRNG returning [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSampleState(seed: number): SampleState {
  const random = seededRandom(seed);
  const fill: FillRandom = (bytes) => {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
    return bytes;
  };
  return { random, fill, counter: 0 };
}

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

/** Everything the rules read about the seller, loaded in one round trip. */
type State = {
  kitchen: Kitchen;
  settings: KitchenSettings;
  week: Week;
  items: Array<MenuItem>;
  /** Portions taken per item by live, not cancelled orders. */
  used: Map<string, number>;
  chefs: Array<Chef>;
};

type StaffInsert = { status?: OrderStatus; paid?: boolean; returning?: boolean };

const USED_SQL = `SELECT l.item_id AS item_id, SUM(l.qty) AS used
  FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
  WHERE o.seller_id = ? AND o.past_week_id IS NULL AND o.status <> 'cancelled'`;

/** A draft change to one order: the new state plus the entries to append. */
type Draft = OrderChange;

export type SellerInternal = {
  repo: SellerRepository;
  addSampleOrders(count: number): Promise<number>;
};

export function createSellerInternal(deps: Deps, seller: Seller): SellerInternal {
  const { db } = deps;
  const sid = seller.id;
  const nowIso = () => deps.now().toISOString();

  // ---- Reading ----

  function usedStatement(exceptOrderId?: string): D1Statement {
    return exceptOrderId === undefined
      ? db.stmt(`${USED_SQL} GROUP BY l.item_id`, sid)
      : db.stmt(`${USED_SQL} AND o.id <> ? GROUP BY l.item_id`, sid, exceptOrderId);
  }

  async function loadState(exceptOrderId?: string): Promise<State> {
    const [kitchens, images, settings, weeks, points, items, used, chefs] = await db.reads([
      db.stmt('SELECT * FROM kitchens WHERE seller_id = ?', sid),
      db.stmt('SELECT slot, ref FROM kitchen_images WHERE seller_id = ?', sid),
      db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
      db.stmt('SELECT * FROM weeks WHERE seller_id = ?', sid),
      db.stmt('SELECT * FROM pickup_points WHERE seller_id = ? ORDER BY position', sid),
      db.stmt('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      usedStatement(exceptOrderId),
      db.stmt('SELECT id, name FROM chefs WHERE seller_id = ? ORDER BY position', sid),
    ]);
    const kitchen = kitchens[0] as KitchenRow | undefined;
    const settingsRow = settings[0] as SettingsRow | undefined;
    const weekRow = weeks[0] as WeekRow | undefined;
    if (!kitchen || !settingsRow || !weekRow) throw new Error(`Seller ${sid} has no kitchen rows`);
    return {
      kitchen: kitchenOf(sid, kitchen, images as Array<ImageRow>),
      settings: settingsOf(settingsRow),
      week: weekOf(weekRow, points as Array<PickupRow>),
      items: (items as Array<ItemRow>).map(itemOf),
      used: new Map(
        (used as Array<{ item_id: string; used: number }>).map((row) => [row.item_id, row.used]),
      ),
      chefs: (chefs as Array<ChefRow>).map((row) => chefOf(sid, row)),
    };
  }

  async function readWeek(): Promise<Week> {
    const [weeks, points] = await db.reads([
      db.stmt('SELECT * FROM weeks WHERE seller_id = ?', sid),
      db.stmt('SELECT * FROM pickup_points WHERE seller_id = ? ORDER BY position', sid),
    ]);
    return weekOf(weeks[0] as WeekRow, points as Array<PickupRow>);
  }

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

  async function readSets(): Promise<Array<SavedSet>> {
    const [sets, items, images] = await db.reads([
      db.stmt('SELECT * FROM saved_sets WHERE seller_id = ? ORDER BY position', sid),
      db.stmt('SELECT * FROM saved_set_items WHERE seller_id = ? ORDER BY set_id, position', sid),
      db.stmt('SELECT set_id, slot, ref FROM saved_set_images WHERE seller_id = ?', sid),
    ]);
    return (sets as Array<SetRow>).map((set) => ({
      id: set.id,
      name: set.name,
      items: (items as Array<SetItemRow>).filter((i) => i.set_id === set.id).map(setItemOf),
      images: imagesOf(
        (images as Array<SetImageRow>).filter((i) => i.set_id === set.id),
        set.banner_background,
        set.image_alt_en,
        set.image_alt_id,
      ),
    }));
  }

  function setView(set: SavedSet): SavedSetView {
    return {
      id: set.id,
      name: set.name,
      items: set.items,
      imageSlots: IMAGE_SLOTS.filter((slot) => set.images[slot] !== undefined),
    };
  }

  // ---- Menu rules ----

  function ordering(s: Pick<State, 'settings' | 'week'>): OrderingState {
    if (!s.settings.orderingOpen) return { open: false, reason: 'closed_by_seller' };
    if (deps.now().getTime() >= Date.parse(s.week.cutoffAt)) {
      return { open: false, reason: 'cutoff_passed' };
    }
    return { open: true };
  }

  /** The error that stops a customer from placing or changing an order, if any. */
  function closedError<T>(s: State): StoreResult<T> | null {
    const state = ordering(s);
    if (state.reason === 'closed_by_seller') return fail('ordering_closed', 'Ordering is closed');
    if (state.reason === 'cutoff_passed') return fail('cutoff_passed', 'Orders are closed');
    return null;
  }

  function sellerView(item: MenuItem, used: Map<string, number>): SellerMenuItemView {
    const { soldOut: manual, ...rest } = item;
    const remaining =
      item.limit === undefined ? null : Math.max(0, item.limit - (used.get(item.id) ?? 0));
    return {
      ...rest,
      remaining,
      soldOut: manual === true || remaining === 0,
      ...(manual === true ? { manualSoldOut: true } : {}),
    };
  }

  /** The customer view: the chef (D-012) and the manual flag are dropped here. */
  function view(item: MenuItem, used: Map<string, number>): MenuItemView {
    const copy = sellerView(item, used);
    delete copy.chefId;
    delete copy.manualSoldOut;
    return copy;
  }

  function publicMenu(s: State): MenuResponse {
    return {
      seller: { ...seller },
      kitchen: {
        ...s.kitchen,
        ...(s.settings.whatsappNumber ? { whatsappNumber: s.settings.whatsappNumber } : {}),
      },
      week: s.week,
      items: s.items.map((item) => view(item, s.used)),
      ordering: ordering(s),
    };
  }

  /** Any live order that is not cancelled counts as "has orders" (D-020). */
  async function itemHasOrders(itemId: string): Promise<boolean> {
    const row = await db.first(
      `SELECT 1 AS hit FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
       WHERE o.seller_id = ? AND o.past_week_id IS NULL AND o.status <> 'cancelled' AND l.item_id = ? LIMIT 1`,
      sid,
      itemId,
    );
    return row !== null;
  }

  async function sellerItems(): Promise<Array<SellerMenuItemView>> {
    const s = await loadState();
    return s.items.map((item) => sellerView(item, s.used));
  }

  // ---- Order rules ----

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
   * Checks the requested lines against the menu and the remaining portions (`s.used` must leave
   * out the order being edited). A line already on the order keeps its snapshot (D-020).
   */
  function buildLines(
    s: State,
    requested: Array<RequestedLine>,
    existing: Array<OrderLine> = [],
  ): StoreResult<Array<OrderLine>> {
    const lines: Array<OrderLine> = [];
    for (const { itemId, qty } of requested) {
      const item = s.items.find((candidate) => candidate.id === itemId);
      if (!item) return fail('unknown_item', `Unknown item: ${itemId}`);
      const previous = existing.find((line) => line.itemId === itemId);
      // Manually sold out: no new portions (an order may keep what it already has).
      if (item.soldOut === true && (!previous || qty > previous.qty)) {
        return fail('sold_out', `${item.name.en} is sold out`);
      }
      if (item.limit !== undefined) {
        const left = item.limit - (s.used.get(itemId) ?? 0);
        if (left <= 0) return fail('sold_out', `${item.name.en} is sold out`);
        if (qty > left) return fail('exceeds_remaining', `Only ${left} left of ${item.name.en}`);
      }
      lines.push(previous ? { ...previous, qty } : snapshot(item, qty));
    }
    return ok(lines);
  }

  const draft = (order: SellerOrder): Draft => ({
    order,
    linesChanged: false,
    audits: [],
    inboxes: [],
  });

  function addAudit(d: Draft, entry: Omit<AuditEntry, 'at'>): Draft {
    const full: AuditEntry = { ...entry, at: nowIso() };
    return {
      ...d,
      order: {
        ...d.order,
        audit: [full, ...d.order.audit].slice(0, AUDIT_MAX),
        updatedAt: full.at,
      },
      audits: [...d.audits, full],
    };
  }

  function addInbox(d: Draft, entry: Omit<InboxEntry, 'at'>): Draft {
    const full: InboxEntry = { ...entry, at: nowIso() };
    return {
      ...d,
      order: { ...d.order, inbox: [full, ...d.order.inbox].slice(0, INBOX_MAX) },
      inboxes: [...d.inboxes, full],
    };
  }

  const withOrder = (d: Draft, patch: Partial<SellerOrder>): Draft => ({
    ...d,
    order: { ...d.order, ...patch },
  });

  async function commit(d: Draft): Promise<SellerOrder> {
    await db.batch(changeStatements(db, d));
    return d.order;
  }

  async function uniqueCode(make: () => string): Promise<string> {
    let code = make();
    // Codes are unique per seller across live and closed-week orders (UNIQUE (seller_id, code)).
    while (
      await db.first('SELECT 1 AS hit FROM orders WHERE seller_id = ? AND code = ?', sid, code)
    ) {
      code = make();
    }
    return code;
  }

  function buildOrder(
    input: CreateOrderRequest | CreateSellerOrderRequest,
    lines: Array<OrderLine>,
    by: Actor,
    enteredBy: StaffActor | undefined,
    make: { id: string; code: string; token: string },
    extra: StaffInsert,
  ): SellerOrder {
    const at = nowIso();
    const status: OrderStatus = extra.status ?? (enteredBy ? 'confirmed' : 'ordered');
    return {
      id: make.id,
      sellerId: sid,
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
  }

  async function place(
    s: State,
    input: CreateOrderRequest | CreateSellerOrderRequest,
    by: Actor,
    enteredBy: StaffActor | undefined,
    extra: StaffInsert,
  ): Promise<StoreResult<SellerOrder>> {
    const lines = buildLines(s, input.lines);
    if (!lines.ok) return lines;
    const id = deps.newId();
    const code = await uniqueCode(deps.newCode);
    const token = deps.newToken();
    const order = buildOrder(input, lines.value, by, enteredBy, { id, code, token }, extra);
    await db.batch(insertOrderStatements(db, order, null));
    return ok(order);
  }

  /** Applies the patch fields to a copy of the order (limits checked), without any other rule. */
  function patched(
    s: State,
    order: SellerOrder,
    patch: UpdateOrderRequest,
  ): StoreResult<SellerOrder> {
    let next: SellerOrder = order;
    if (patch.lines) {
      const lines = buildLines(s, patch.lines, order.lines);
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

  /** Records a customer edit: the audit diff and the "changed" flag. No-op if nothing differs. */
  function editDraft(order: SellerOrder, next: SellerOrder, linesChanged: boolean): Draft | null {
    const diff = diffOrder(order, next);
    if (!diff) return null;
    return addAudit(
      { ...draft({ ...next, changed: true }), linesChanged },
      { by: { role: 'customer', name: order.firstName }, what: 'edited', diff },
    );
  }

  async function changeByCode(
    code: string,
    change: (order: SellerOrder) => StoreResult<Draft>,
  ): Promise<StoreResult<SellerOrder>> {
    const order = await readLiveOrder(db, sid, 'code', code);
    if (!order) return fail('not_found', 'Order not found');
    const result = change(order);
    return result.ok ? ok(await commit(result.value)) : result;
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
  };
  type PastItemRow = {
    past_week_id: string;
    item_id: string;
    name_en: string;
    name_id: string;
    qty: number;
  };

  async function readPastWeeks(): Promise<Array<PastWeekSummary>> {
    await dropExpiredDetails(db, sid, deps.now());
    const [weeks, items] = await db.reads([
      db.stmt('SELECT * FROM past_weeks WHERE seller_id = ? ORDER BY rowid DESC', sid),
      db.stmt(
        'SELECT * FROM past_week_items WHERE seller_id = ? ORDER BY past_week_id, position',
        sid,
      ),
    ]);
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
    }));
  }

  // ---- Samples (dev) ----

  async function sampleState(): Promise<SampleState> {
    let state = deps.samples.get(sid);
    if (!state) {
      const row = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM sellers WHERE rowid < (SELECT rowid FROM sellers WHERE id = ?)',
        sid,
      );
      state = newSampleState(deps.seed + (row?.n ?? 0));
      deps.samples.set(sid, state);
    }
    return state;
  }

  async function addSampleOrders(count: number): Promise<number> {
    const sample = await sampleState();
    const { random } = sample;
    let added = 0;
    for (let n = 0; n < count; n++) {
      const s = await loadState();
      const items = s.items;
      if (items.length === 0) break;
      const picks = items.filter(() => random() < 0.4);
      if (picks.length === 0) picks.push(items[Math.floor(random() * items.length)] as MenuItem);
      const requested: Array<RequestedLine> = [];
      for (const item of picks.slice(0, 3)) {
        const left = item.limit === undefined ? 3 : item.limit - (s.used.get(item.id) ?? 0);
        const qty = Math.min(1 + Math.floor(random() * 3), left);
        if (qty >= 1) requested.push({ itemId: item.id, qty });
      }
      if (requested.length === 0) continue;
      const lines = buildLines(s, requested);
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
      const code = await uniqueCode(() => generateOrderCode(sample.fill));
      const order = buildOrder(
        input,
        lines.value,
        { role: 'customer', name: firstName },
        undefined,
        {
          id: `sample-${seller.slug}-${String(++sample.counter)}`,
          code,
          token: generateToken(sample.fill),
        },
        { returning: random() < 0.3 },
      );
      let current = draft(order);
      if (random() < 0.4) {
        current = addInbox(withOrder(current, { status: 'confirmed' }), {
          kind: 'status',
          status: 'confirmed',
        });
      }
      if (random() < 0.25) current = withOrder(current, { waReceived: true });
      if (random() < 0.2) {
        // A customer edit after placing: flip fulfilment, change the note, and add an unlimited item.
        const extra = items.find(
          (item) =>
            item.limit === undefined &&
            !current.order.lines.some((line) => line.itemId === item.id),
        );
        const edit = patched(s, current.order, {
          fulfilment: current.order.fulfilment === 'pickup' ? 'delivery' : 'pickup',
          note: 'Changed my mind, thanks',
          ...(extra ? { lines: [...current.order.lines, { itemId: extra.id, qty: 1 }] } : {}),
        });
        if (edit.ok) {
          const edited = editDraft(current.order, edit.value, true);
          if (edited) {
            current = {
              ...edited,
              audits: [...current.audits, ...edited.audits],
              inboxes: [...current.inboxes, ...edited.inboxes],
            };
          }
        }
      }
      if (random() < 0.15) current = withOrder(current, { locked: true });
      await db.batch([...insertOrderStatements(db, order, null), ...changeStatements(db, current)]);
      added++;
    }
    return added;
  }

  // ---- The repository ----

  const repo: SellerRepository = {
    seller,

    async getMenu() {
      return publicMenu(await loadState());
    },

    async getSellerMenu(): Promise<SellerMenuResponse> {
      const s = await loadState();
      const menu = publicMenu(s);
      return { ...menu, chefs: s.chefs, items: s.items.map((item) => sellerView(item, s.used)) };
    },

    async getSettings() {
      const row = (await db.first<SettingsRow>(
        'SELECT * FROM kitchen_settings WHERE seller_id = ?',
        sid,
      )) as SettingsRow;
      return settingsOf(row);
    },

    /** Replaces the settings; the caller has already validated and normalised them. */
    async setSettings(next) {
      await db.batch([
        db.stmt('DELETE FROM kitchen_settings WHERE seller_id = ?', sid),
        settingsStatement(db, sid, next),
      ]);
      return structuredClone(next);
    },

    // ---- Week ----

    getWeek: readWeek,

    /** One pickup point for now (D-008); the ordering switch stays in the settings. */
    async updateWeek(input: WeekSettingsRequest) {
      const current = await readWeek();
      const point = input.pickupPoints[0];
      await db.batch([
        db.stmt(
          `UPDATE weeks SET cooking_date = ?, cutoff_at = ?, delivery_available = ?, delivery_note_en = ?,
             delivery_note_id = ? WHERE seller_id = ?`,
          input.cookingDate,
          input.cutoffAt,
          input.delivery.available,
          input.delivery.note.en,
          input.delivery.note.id,
          sid,
        ),
        db.stmt('DELETE FROM pickup_points WHERE seller_id = ?', sid),
        pickupStatement(
          db,
          sid,
          {
            id: point.id ?? current.pickupPoints[0]?.id ?? 'main',
            place: point.place,
            directions: { ...point.directions },
            window: { ...point.window },
          },
          0,
        ),
      ]);
      return readWeek();
    },

    async publishWeek() {
      const row = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM menu_items WHERE seller_id = ?',
        sid,
      );
      if ((row?.n ?? 0) === 0) return fail('no_items', 'Add at least one item first');
      await db.stmt("UPDATE weeks SET status = 'published' WHERE seller_id = ?", sid).run();
      return ok(await readWeek());
    },

    async unpublishWeek() {
      await db.stmt("UPDATE weeks SET status = 'draft' WHERE seller_id = ?", sid).run();
      return readWeek();
    },

    /**
     * Archives the week (totals kept for good, orders for 4 weeks) and starts the next draft
     * week 7 days later with the same items. Orders leave the live list.
     */
    async closeWeek() {
      const [orders, week] = await Promise.all([
        readOrders(db, sid, 'o.past_week_id IS NULL'),
        readWeek(),
      ]);
      const id = deps.newId();
      const totals = summariseOrders(orders);
      await db.batch([
        db.stmt(
          `INSERT INTO past_weeks (seller_id, id, cooking_date, closed_at, orders_count, cancelled_count, income_cents,
             paid_cents, unpaid_cents, details_dropped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          sid,
          id,
          week.cookingDate,
          nowIso(),
          totals.orders,
          totals.cancelled,
          totals.incomeCents,
          totals.paidCents,
          totals.unpaidCents,
        ),
        ...totals.items.map((item, position) =>
          db.stmt(
            `INSERT INTO past_week_items (seller_id, past_week_id, position, item_id, name_en, name_id, qty)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            sid,
            id,
            position,
            item.itemId,
            item.name.en,
            item.name.id,
            item.qty,
          ),
        ),
        db.stmt(
          'UPDATE orders SET past_week_id = ? WHERE seller_id = ? AND past_week_id IS NULL',
          id,
          sid,
        ),
        db.stmt(
          "UPDATE weeks SET cooking_date = ?, cutoff_at = ?, status = 'draft' WHERE seller_id = ?",
          shiftDays(week.cookingDate, 7),
          shiftDays(week.cutoffAt, 7),
          sid,
        ),
        db.stmt('UPDATE menu_items SET sold_out = 0 WHERE seller_id = ?', sid),
      ]);
      const closed = (await readPastWeeks()).find((candidate) => candidate.id === id);
      return { week: await readWeek(), closed: closed as PastWeekSummary };
    },

    listPastWeeks: readPastWeeks,

    async getPastWeek(id: string): Promise<PastWeek | undefined> {
      const found = (await readPastWeeks()).find((candidate) => candidate.id === id);
      if (!found) return undefined;
      const { hasOrders, ...rest } = found;
      if (!hasOrders) return rest;
      return { ...rest, orders: await readOrders(db, sid, 'o.past_week_id = ?', id) };
    },

    // ---- Menu items (D-020: edits only touch new orders; snapshots live on the order lines) ----

    async addItem(input: CreateItemRequest) {
      const [counts, chefs] = await db.reads([
        db.stmt(
          'SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS top FROM menu_items WHERE seller_id = ?',
          sid,
        ),
        db.stmt('SELECT id FROM chefs WHERE seller_id = ? AND id = ?', sid, input.chefId ?? ''),
      ]);
      const { n, top } = counts[0] as { n: number; top: number };
      if (n >= MAX_MENU_ITEMS)
        return fail('limit_reached', `At most ${String(MAX_MENU_ITEMS)} items`);
      if (input.chefId !== undefined && chefs.length === 0) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const item: MenuItem = {
        id: deps.newId(),
        name: { ...input.name },
        description: { ...(input.description ?? { en: '', id: '' }) },
        size: { ...(input.size ?? { en: '', id: '' }) },
        priceCents: input.priceCents,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.chefId !== undefined ? { chefId: input.chefId } : {}),
      };
      await itemStatement(db, sid, item, top + 1).run();
      return ok(sellerView(item, new Map()));
    },

    async patchItem(id: string, patch: UpdateItemRequest) {
      const [rows, chefs, used] = await db.reads([
        db.stmt('SELECT * FROM menu_items WHERE seller_id = ? AND id = ?', sid, id),
        db.stmt(
          'SELECT id FROM chefs WHERE seller_id = ? AND id = ?',
          sid,
          typeof patch.chefId === 'string' ? patch.chefId : '',
        ),
        usedStatement(),
      ]);
      const row = rows[0] as ItemRow | undefined;
      if (!row) return fail('not_found', 'Item not found');
      if (typeof patch.chefId === 'string' && chefs.length === 0) {
        return fail('unknown_chef', 'Unknown chef');
      }
      const next: MenuItem = { ...itemOf(row) };
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
      await db
        .stmt(
          `UPDATE menu_items SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, size_en = ?, size_id = ?,
             price_cents = ?, portion_limit = ?, chef_id = ?, sold_out = ? WHERE seller_id = ? AND id = ?`,
          next.name.en,
          next.name.id,
          next.description.en,
          next.description.id,
          next.size.en,
          next.size.id,
          next.priceCents,
          next.limit ?? null,
          next.chefId ?? null,
          next.soldOut === true,
          sid,
          id,
        )
        .run();
      const usedMap = new Map(
        (used as Array<{ item_id: string; used: number }>).map((r) => [r.item_id, r.used]),
      );
      return ok(sellerView(next, usedMap));
    },

    /** `ids` must list every item once. */
    async reorderItems(ids: ReadonlyArray<string>) {
      const rows = await db.all<{ id: string }>(
        'SELECT id FROM menu_items WHERE seller_id = ?',
        sid,
      );
      const same = ids.length === rows.length && rows.every((row) => ids.includes(row.id));
      if (!same) return fail('invalid_request', 'List every item once');
      await db.batch(
        ids.map((id, position) =>
          db.stmt(
            'UPDATE menu_items SET position = ? WHERE seller_id = ? AND id = ?',
            position,
            sid,
            id,
          ),
        ),
      );
      return ok(await sellerItems());
    },

    /** An item with a live (not cancelled) order can't be deleted; mark it sold out instead. */
    async removeItem(id: string) {
      const found = await db.first(
        'SELECT 1 AS hit FROM menu_items WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Item not found');
      if (await itemHasOrders(id)) {
        return fail('item_has_orders', 'This item has orders; mark it sold out');
      }
      await db.stmt('DELETE FROM menu_items WHERE seller_id = ? AND id = ?', sid, id).run();
      return ok(true as const);
    },

    // ---- Chefs ----

    async listChefs() {
      const rows = await db.all<ChefRow>(
        'SELECT id, name FROM chefs WHERE seller_id = ? ORDER BY position',
        sid,
      );
      return rows.map((row) => chefOf(sid, row));
    },

    async addChef(name: string) {
      const row = await db.first<{ n: number; top: number }>(
        'SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS top FROM chefs WHERE seller_id = ?',
        sid,
      );
      if ((row?.n ?? 0) >= MAX_CHEFS) return fail('limit_reached', 'Too many chefs');
      const chef: Chef = { id: deps.newId(), sellerId: sid, name };
      await chefStatement(db, chef, (row?.top ?? -1) + 1).run();
      return ok({ ...chef });
    },

    async renameChef(id: string, name: string) {
      const found = await db.first(
        'SELECT 1 AS hit FROM chefs WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Chef not found');
      await db
        .stmt('UPDATE chefs SET name = ? WHERE seller_id = ? AND id = ?', name, sid, id)
        .run();
      return ok({ id, sellerId: sid, name });
    },

    /** Deleting a chef unassigns their items (this week and in saved sets). */
    async removeChef(id: string) {
      const found = await db.first(
        'SELECT 1 AS hit FROM chefs WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Chef not found');
      await db.batch([
        db.stmt(
          'UPDATE menu_items SET chef_id = NULL WHERE seller_id = ? AND chef_id = ?',
          sid,
          id,
        ),
        db.stmt(
          'UPDATE saved_set_items SET chef_id = NULL WHERE seller_id = ? AND chef_id = ?',
          sid,
          id,
        ),
        db.stmt('DELETE FROM chefs WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok(true as const);
    },

    // ---- Saved sets ----

    async listSets() {
      return (await readSets()).map(setView);
    },

    /** Saves the week's items and the current images. A 6th set needs `replaceSetId`. */
    async saveSet(name: string, replaceSetId?: string) {
      const [s, sets, images] = await Promise.all([loadState(), readSets(), readImages()]);
      if (s.items.length === 0) return fail('no_items', 'Add at least one item first');
      const target =
        replaceSetId === undefined ? undefined : sets.find((set) => set.id === replaceSetId);
      if (replaceSetId !== undefined && !target) return fail('not_found', 'Set not found');
      if (!target && sets.length >= MAX_SETS) {
        return fail('limit_reached', `At most ${String(MAX_SETS)} sets; replace one`);
      }
      const saved: SavedSet = {
        id: target?.id ?? deps.newId(),
        name,
        items: s.items.map((item) => structuredClone(without(without(item, 'id'), 'soldOut'))),
        images: structuredClone(images),
      };
      const position = target ? sets.findIndex((set) => set.id === saved.id) : sets.length;
      await db.batch([
        ...(target
          ? [
              db.stmt(
                'DELETE FROM saved_set_images WHERE seller_id = ? AND set_id = ?',
                sid,
                saved.id,
              ),
              db.stmt(
                'DELETE FROM saved_set_items WHERE seller_id = ? AND set_id = ?',
                sid,
                saved.id,
              ),
              db.stmt('DELETE FROM saved_sets WHERE seller_id = ? AND id = ?', sid, saved.id),
            ]
          : []),
        ...setStatements(db, sid, saved, position),
      ]);
      return ok(setView(saved));
    },

    async renameSet(id: string, name: string) {
      const set = (await readSets()).find((candidate) => candidate.id === id);
      if (!set) return fail('not_found', 'Set not found');
      await db
        .stmt('UPDATE saved_sets SET name = ? WHERE seller_id = ? AND id = ?', name, sid, id)
        .run();
      return ok(setView({ ...set, name }));
    },

    async removeSet(id: string) {
      const found = await db.first(
        'SELECT 1 AS hit FROM saved_sets WHERE seller_id = ? AND id = ?',
        sid,
        id,
      );
      if (!found) return fail('not_found', 'Set not found');
      await db.batch([
        db.stmt('DELETE FROM saved_set_images WHERE seller_id = ? AND set_id = ?', sid, id),
        db.stmt('DELETE FROM saved_set_items WHERE seller_id = ? AND set_id = ?', sid, id),
        db.stmt('DELETE FROM saved_sets WHERE seller_id = ? AND id = ?', sid, id),
      ]);
      return ok(true as const);
    },

    /**
     * Replaces a draft week's items with the set's. Needs `confirm` when the week has items;
     * refused while a current item has orders (D-020).
     */
    async useSet(id: string, request: UseSetRequest) {
      const [s, sets, images] = await Promise.all([loadState(), readSets(), readImages()]);
      const set = sets.find((candidate) => candidate.id === id);
      if (!set) return fail('not_found', 'Set not found');
      if (s.week.status !== 'draft') return fail('week_not_draft', 'Unpublish the week first');
      if (s.items.length > 0 && request.confirm !== true) {
        return fail('confirm_required', 'This replaces the items of the week');
      }
      for (const item of s.items) {
        if (await itemHasOrders(item.id)) {
          return fail('item_has_orders', 'Some items already have orders');
        }
      }
      const known = new Set(s.chefs.map((chef) => chef.id));
      const items = set.items.map((item) => {
        const copy: MenuItem = { ...structuredClone(item), id: deps.newId() };
        return copy.chefId === undefined || known.has(copy.chefId) ? copy : without(copy, 'chefId');
      });
      const statements = [
        db.stmt('DELETE FROM menu_items WHERE seller_id = ?', sid),
        ...items.map((item, position) => itemStatement(db, sid, item, position)),
      ];
      if (request.applyImages === true) {
        const alt = images.alt;
        statements.push(
          ...imageStatements({ ...structuredClone(set.images), ...(alt ? { alt } : {}) }),
        );
      }
      await db.batch(statements);
      return ok(items.map((item) => sellerView(item, new Map())));
    },

    // ---- Images (D-038, D-040) ----

    getImages: readImages,

    async setImage(slot: ImageSlot, dataUrl: unknown, ref?: string) {
      const check = checkImageUpload(slot, dataUrl);
      if (!check.ok) {
        const message = {
          image_type: 'Use a jpeg, png or webp image',
          image_too_big: 'The image is over 600 KB',
          image_ratio: 'The image has the wrong shape for this place',
        }[check.error];
        return fail(check.error, message);
      }
      const next = { ...(await readImages()), [slot]: ref ?? (dataUrl as string) };
      await db.batch(imageStatements(next));
      return ok(next);
    },

    async removeImage(slot: ImageSlot) {
      const next = without(await readImages(), slot);
      await db.batch(imageStatements(next));
      return next;
    },

    /** Banner colour and alt text. */
    async setImageStyle(style: ImageStyleRequest) {
      const current = await readImages();
      const slots = without(without(current, 'bannerBackground'), 'alt');
      const colour =
        style.bannerBackground === undefined ? current.bannerBackground : style.bannerBackground;
      const alt = style.alt === undefined ? current.alt : style.alt;
      const hasAlt = alt !== undefined && (alt.en !== '' || alt.id !== '');
      const next: KitchenImages = {
        ...slots,
        ...(colour ? { bannerBackground: colour } : {}),
        ...(hasAlt ? { alt } : {}),
      };
      await db.batch(imageStatements(next));
      return next;
    },

    // ---- Backup and CSV ----

    async exportBackup(): Promise<BackupFile> {
      await dropExpiredDetails(db, sid, deps.now());
      const [s, sets, live, past, archived, pastRows] = await Promise.all([
        loadState(),
        readSets(),
        readOrders(db, sid, 'o.past_week_id IS NULL'),
        readPastWeeks(),
        readOrders(db, sid, 'o.past_week_id IS NOT NULL'),
        db.all<{ id: string; past_week_id: string }>(
          'SELECT id, past_week_id FROM orders WHERE seller_id = ? AND past_week_id IS NOT NULL',
          sid,
        ),
      ]);
      const weekOfOrder = new Map(pastRows.map((row) => [row.id, row.past_week_id]));
      return structuredClone({
        version: BACKUP_VERSION,
        exportedAt: nowIso(),
        seller: { slug: seller.slug, name: seller.name },
        kitchen: s.kitchen,
        settings: s.settings,
        week: s.week,
        items: s.items,
        chefs: s.chefs,
        sets,
        orders: live,
        pastWeeks: past.map(({ hasOrders, ...rest }): PastWeek => {
          if (!hasOrders) return rest;
          return {
            ...rest,
            orders: archived.filter((order) => weekOfOrder.get(order.id) === rest.id),
          };
        }),
      });
    },

    /** Replaces this seller's data with an already validated backup; other sellers are not touched. */
    async restoreBackup(file: BackupFile) {
      const copy = structuredClone(file);
      const at = nowIso();
      const chefs = copy.chefs.map((chef) => ({ ...chef, sellerId: sid }));
      const known = new Set(chefs.map((chef) => chef.id));
      const fixChef = <T extends { chefId?: string }>(item: T): T =>
        item.chefId === undefined || known.has(item.chefId) ? item : (without(item, 'chefId') as T);
      const items = copy.items.map(fixChef);
      const sets = copy.sets.map((set) => ({ ...set, items: set.items.map(fixChef) }));
      const forMe = (order: SellerOrder): SellerOrder => ({ ...order, sellerId: sid });
      const own = (table: string) => db.stmt(`DELETE FROM ${table} WHERE seller_id = ?`, sid);
      const chefList = [...known];

      const statements: Array<D1Statement> = [
        // Everything this seller has, children before parents. Chefs that stay keep their account.
        own('order_audit'),
        own('order_inbox'),
        own('order_lines'),
        own('orders'),
        own('expired_orders'),
        own('past_week_items'),
        own('past_weeks'),
        own('saved_set_images'),
        own('saved_set_items'),
        own('saved_sets'),
        own('menu_items'),
        own('pickup_points'),
        own('weeks'),
        own('kitchen_images'),
        own('kitchens'),
        own('kitchen_settings'),
        chefList.length === 0
          ? own('chefs')
          : db.stmt(
              `DELETE FROM chefs WHERE seller_id = ? AND id NOT IN (${marks(chefList.length)})`,
              sid,
              ...chefList,
            ),
      ];
      chefs.forEach((chef, position) => {
        statements.push(
          db.stmt(
            `INSERT INTO chefs (seller_id, id, name, position) VALUES (?, ?, ?, ?)
             ON CONFLICT (seller_id, id) DO UPDATE SET name = excluded.name, position = excluded.position`,
            sid,
            chef.id,
            chef.name,
            position,
          ),
        );
      });
      statements.push(
        ...kitchenStatements(db, { ...copy.kitchen, sellerId: sid, name: copy.kitchen.name }, at),
        settingsStatement(db, sid, copy.settings),
        ...weekStatements(db, sid, copy.week),
        ...items.map((item, position) => itemStatement(db, sid, item, position)),
        ...sets.flatMap((set, position) => setStatements(db, sid, set, position)),
      );
      // Newest closed week is first in the file; rows are listed newest-inserted first, so the
      // oldest goes in first.
      for (const past of [...copy.pastWeeks].reverse()) {
        const kept = past.orders !== undefined && keepsOrderDetails(past.cookingDate, deps.now());
        statements.push(
          db.stmt(
            `INSERT INTO past_weeks (seller_id, id, cooking_date, closed_at, orders_count, cancelled_count, income_cents,
               paid_cents, unpaid_cents, details_dropped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sid,
            past.id,
            past.cookingDate,
            past.closedAt,
            past.totals.orders,
            past.totals.cancelled,
            past.totals.incomeCents,
            past.totals.paidCents,
            past.totals.unpaidCents,
            kept ? null : at,
          ),
          ...past.totals.items.map((item, position) =>
            db.stmt(
              `INSERT INTO past_week_items (seller_id, past_week_id, position, item_id, name_en, name_id, qty)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              sid,
              past.id,
              position,
              item.itemId,
              item.name.en,
              item.name.id,
              item.qty,
            ),
          ),
        );
        for (const order of past.orders ?? []) {
          if (kept) statements.push(...insertOrderStatements(db, forMe(order), past.id));
          else {
            statements.push(
              db.stmt(
                'INSERT OR IGNORE INTO expired_orders (token, seller_id, cooking_date) VALUES (?, ?, ?)',
                order.token,
                sid,
                past.cookingDate,
              ),
            );
          }
        }
      }
      for (const order of copy.orders) {
        statements.push(...insertOrderStatements(db, forMe(order), null));
      }
      await db.batch(statements);
    },

    /** Every live order, oldest first, as CSV with a BOM for Excel. */
    async ordersCsv() {
      return ordersToCsv(await readOrders(db, sid, 'o.past_week_id IS NULL'));
    },

    // ---- Orders: customer side ----

    /** Customer order: refused for a draft week, when closed by the seller, or after the cut-off. */
    async createOrder(input: CreateOrderRequest) {
      const s = await loadState();
      if (s.week.status !== 'published') return fail('week_not_published', 'The menu is not open');
      const closed = closedError<SellerOrder>(s);
      if (closed) return closed;
      return place(s, input, { role: 'customer', name: input.firstName }, undefined, {
        returning: input.returning ?? false,
      });
    },

    /** Customer change: not when closed, locked or final. */
    async updateOrder(token: string, patch: UpdateOrderRequest) {
      const order = await readLiveOrder(db, sid, 'token', token);
      if (!order) return fail('not_found', 'Order not found');
      const s = await loadState(order.id);
      const closed = closedError<SellerOrder>(s);
      if (closed) return closed;
      if (order.locked) return fail('order_locked', 'The seller has locked this order');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      const next = patched(s, order, patch);
      if (!next.ok) return next;
      const edited = editDraft(order, next.value, patch.lines !== undefined);
      return ok(edited ? await commit(edited) : order);
    },

    /** Customer cancel (a change, so refused when closed or locked). */
    async cancelOrder(token: string) {
      const order = await readLiveOrder(db, sid, 'token', token);
      if (!order) return fail('not_found', 'Order not found');
      const s = await loadState(order.id);
      const closed = closedError<SellerOrder>(s);
      if (closed) return closed;
      if (order.locked) return fail('order_locked', 'The seller has locked this order');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      const cancelled = addInbox(withOrder(draft(order), { status: 'cancelled' }), {
        kind: 'status',
        status: 'cancelled',
      });
      return ok(
        await commit(
          addAudit(cancelled, {
            by: { role: 'customer', name: order.firstName },
            what: 'status',
            detail: 'cancelled',
          }),
        ),
      );
    },

    // ---- Orders: seller and chef side ----

    /**
     * Seller/chef-entered order: starts confirmed unless `confirmNow` is false, `paid` defaults
     * to false (D-027). Allowed after the cut-off (D-024).
     */
    async createSellerOrder(input: CreateSellerOrderRequest, actor: StaffActor) {
      const s = await loadState();
      return place(s, input, actor, actor, {
        status: input.confirmNow === false ? 'ordered' : 'confirmed',
        paid: input.paid ?? false,
      });
    },

    getByCode: (code: string) => readLiveOrder(db, sid, 'code', code),

    /** Newest first. */
    async listOrders() {
      return (await readOrders(db, sid, 'o.past_week_id IS NULL')).reverse();
    },

    /** Moves the order on, tells the customer, and clears the "changed" flag. */
    setStatus(code: string, to: OrderStatus, actor: StaffActor) {
      return changeByCode(code, (order) => {
        if (!nextStatuses(order).includes(to)) {
          return fail('invalid_status', `Cannot move from ${order.status} to ${to}`);
        }
        const moved = addInbox(withOrder(draft(order), { status: to, changed: false }), {
          kind: 'status',
          status: to,
        });
        return ok(addAudit(moved, { by: actor, what: 'status', detail: to }));
      });
    },

    setPaid(code: string, paid: boolean, actor: StaffActor) {
      return changeByCode(code, (order) =>
        ok(
          addAudit(withOrder(draft(order), { paid }), {
            by: actor,
            what: 'paid',
            detail: paid ? 'paid' : 'unpaid',
          }),
        ),
      );
    },

    /** Seller lock: the customer can't change or cancel; the seller still can. */
    setLocked(code: string, locked: boolean) {
      return changeByCode(code, (order) =>
        ok(withOrder(draft(order), { locked, updatedAt: nowIso() })),
      );
    },

    setWaReceived(code: string, received: boolean) {
      return changeByCode(code, (order) => ok(withOrder(draft(order), { waReceived: received })));
    },

    /** Adds a nudge to the customer's inbox; the text key differs for returning customers. */
    nudge(code: string) {
      return changeByCode(code, (order) => {
        if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
        const textKey = order.returning ? 'nudgeReturning' : 'nudge';
        return ok(
          withOrder(addInbox(draft(order), { kind: 'nudge', textKey }), { updatedAt: nowIso() }),
        );
      });
    },

    /** "Arriving soon" for one delivery order: an inbox entry only (no status change). */
    arrivingSoon(code: string) {
      return changeByCode(code, (order) => {
        if (order.fulfilment !== 'delivery') {
          return fail('invalid_status', 'Only delivery orders can be arriving soon');
        }
        if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
        return ok(
          withOrder(addInbox(draft(order), { kind: 'message', textKey: 'arrivingSoon' }), {
            updatedAt: nowIso(),
          }),
        );
      });
    },

    /** The seller has seen the customer's change. */
    markSeen(code: string) {
      return changeByCode(code, (order) => ok(withOrder(draft(order), { changed: false })));
    },

    /**
     * One bulk update (stage 7.1) for one order. Cancelled orders get nothing. The message goes to
     * the inbox as a `message` entry (`textKey` = the template, `minutes`, or the custom `text`);
     * with `alsoSetStatus` the status moves too, but only where nextStatuses allows it. When the
     * template is the plain twin of the status it moved to (ready, outForDelivery, delivered,
     * collected), the status entry already says it, so no second message is added.
     */
    async sendUpdate(
      rawCode: string,
      update: Omit<SendUpdatesRequest, 'codes'>,
      actor: StaffActor,
    ): Promise<UpdateResult> {
      const code = parseOrderCode(rawCode);
      const order = code ? await readLiveOrder(db, sid, 'code', code) : undefined;
      if (!code || !order) return { code: rawCode, ok: false, error: 'not_found' };
      if (order.status === 'cancelled') return { code, ok: false, error: 'invalid_status' };
      const wanted = update.alsoSetStatus === true ? statusOfTemplate(update.template) : null;
      const target = wanted !== null && nextStatuses(order).includes(wanted) ? wanted : null;
      const allowed = target !== null;
      const twin = ['ready', 'outForDelivery', 'delivered', 'collected'].includes(update.template);
      let current = draft(order);
      if (!(allowed && twin)) {
        current = withOrder(
          addInbox(current, {
            kind: 'message',
            ...(update.template === 'custom'
              ? { text: update.text ?? '' }
              : { textKey: update.template }),
            ...(update.minutes !== undefined ? { minutes: update.minutes } : {}),
          }),
          { updatedAt: nowIso() },
        );
      }
      if (target !== null) {
        const moved = addInbox(withOrder(current, { status: target, changed: false }), {
          kind: 'status',
          status: target,
        });
        current = addAudit(moved, { by: actor, what: 'status', detail: target });
      }
      await commit(current);
      return { code, ok: true, statusChanged: allowed };
    },
  };

  return { repo, addSampleOrders };
}
