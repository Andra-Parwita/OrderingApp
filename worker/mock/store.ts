// Pure in-memory store: no Workers APIs, so unit tests and MSW reuse it.
import type { ApiErrorCode } from '../../shared/apiError';
import { diffOrder } from '../../shared/auditDiff';
import type {
  Actor,
  AuditEntry,
  Chef,
  InboxEntry,
  Kitchen,
  KitchenSettings,
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
import { AUDIT_MAX, INBOX_MAX } from '../../shared/limits';
import type { MenuResponse, SellerMenuResponse } from '../../shared/menuContract';
import type {
  CreateOrderRequest,
  CreateSellerOrderRequest,
  RequestedLine,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import { generateOrderCode, generateToken, type FillRandom } from '../../shared/orderCode';
import { isFinalStatus, nextStatuses } from '../../shared/status';
import {
  fixtureChefs,
  fixtureItems,
  fixtureKitchen,
  fixtureSettings,
  fixtureWeek,
} from './fixture';

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

export function createStore(options: StoreOptions) {
  const seed = options.seed ?? 20261011;
  let random = seededRandom(seed);
  const seededFill: FillRandom = (bytes) => {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
    return bytes;
  };
  let idCounter = 0;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const newCode = options.newCode ?? (() => generateOrderCode());
  const newToken = options.newToken ?? (() => generateToken());

  let kitchen: Kitchen = structuredClone(fixtureKitchen);
  let week: Week = structuredClone(fixtureWeek);
  let chefs: Array<Chef> = structuredClone(fixtureChefs);
  let items: Array<MenuItem> = structuredClone(fixtureItems);
  let settings: KitchenSettings = structuredClone(fixtureSettings);
  let orders: Array<Order> = [];

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
    const remaining =
      item.limit === undefined ? null : Math.max(0, item.limit - usedPortions(item.id));
    return { ...item, remaining, soldOut: remaining === 0 };
  }

  /** The customer view: the chef is dropped here (D-012). */
  function view(item: MenuItem): MenuItemView {
    const copy = sellerView(item);
    delete copy.chefId;
    return copy;
  }

  function publicMenu(): MenuResponse {
    return {
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
      if (item.limit !== undefined) {
        const left = item.limit - usedPortions(itemId, exceptOrderId);
        if (left <= 0) return fail('sold_out', `${item.name.en} is sold out`);
        if (qty > left) return fail('exceeds_remaining', `Only ${left} left of ${item.name.en}`);
      }
      const previous = existing.find((line) => line.itemId === itemId);
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
          { id: `sample-${String(++idCounter)}`, code, token: generateToken(seededFill) },
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
      kitchen = structuredClone(fixtureKitchen);
      week = structuredClone(fixtureWeek);
      chefs = structuredClone(fixtureChefs);
      items = structuredClone(fixtureItems);
      settings = structuredClone(fixtureSettings);
      orders = [];
    },
  };
}

export type MockStore = ReturnType<typeof createStore>;
