// Pure in-memory store: no Workers APIs, so unit tests and MSW reuse it.
import type { ApiErrorCode } from '../../shared/apiError';
import type {
  Actor,
  AuditEntry,
  Chef,
  Kitchen,
  MenuItem,
  MenuItemView,
  Order,
  OrderLine,
  OrderStatus,
  StaffActor,
  Week,
} from '../../shared/domain';
import { AUDIT_MAX } from '../../shared/limits';
import type { MenuResponse } from '../../shared/menuContract';
import type {
  CreateOrderRequest,
  RequestedLine,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import { generateOrderCode, generateToken, type FillRandom } from '../../shared/orderCode';
import { isFinalStatus, nextStatuses } from '../../shared/status';
import { fixtureChefs, fixtureItems, fixtureKitchen, fixtureWeek } from './fixture';

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

const SAMPLE_NAMES = ['Rina', 'Tom', 'Sari', 'Budi', 'Mei', 'Dewi', 'Arif', 'Lisa'];

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
  let orders: Array<Order> = [];

  const nowIso = () => options.now().toISOString();
  const cutoffPassed = () => options.now().getTime() >= Date.parse(week.cutoffAt);

  function usedPortions(itemId: string, exceptOrderId?: string): number {
    let used = 0;
    for (const order of orders) {
      if (order.id === exceptOrderId || order.status === 'cancelled') continue;
      for (const line of order.lines) if (line.itemId === itemId) used += line.qty;
    }
    return used;
  }

  function view(item: MenuItem): MenuItemView {
    const remaining =
      item.limit === undefined ? null : Math.max(0, item.limit - usedPortions(item.id));
    return { ...item, remaining, soldOut: remaining === 0 };
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
    input: CreateOrderRequest,
    lines: Array<OrderLine>,
    by: Actor,
    enteredBy: StaffActor | undefined,
    make: { id: string; code: string; token: string },
  ): Order {
    const at = nowIso();
    const order: Order = {
      id: make.id,
      code: make.code,
      token: make.token,
      firstName: input.firstName,
      language: input.language,
      lines,
      fulfilment: input.fulfilment,
      ...(input.note !== undefined ? { note: input.note } : {}),
      // Orders entered by the seller or a chef start as confirmed.
      status: enteredBy ? 'confirmed' : 'ordered',
      paid: false,
      ...(enteredBy ? { enteredBy } : {}),
      audit: [{ by, what: 'created', at }],
      createdAt: at,
      updatedAt: at,
    };
    orders = [...orders, order];
    return order;
  }

  function place(
    input: CreateOrderRequest,
    by: Actor,
    enteredBy: StaffActor | undefined,
  ): StoreResult<Order> {
    const lines = buildLines(input.lines);
    if (!lines.ok) return lines;
    return ok(
      insert(input, lines.value, by, enteredBy, {
        id: newId(),
        code: uniqueCode(newCode),
        token: newToken(),
      }),
    );
  }

  return {
    getMenu(): MenuResponse {
      return { kitchen, week, chefs, items: items.map(view) };
    },

    /** Customer order: refused after the cut-off or while the week is a draft. */
    createOrder(input: CreateOrderRequest): StoreResult<Order> {
      if (week.status !== 'published') return fail('week_not_published', 'The menu is not open');
      if (cutoffPassed()) return fail('cutoff_passed', 'Orders are closed');
      return place(input, { role: 'customer', name: input.firstName }, undefined);
    },

    /** Seller/chef-entered order: starts confirmed. Allowed after the cut-off. */
    createSellerOrder(input: CreateOrderRequest, actor: StaffActor): StoreResult<Order> {
      return place(input, actor, actor);
    },

    getByToken(token: string): Order | undefined {
      return orders.find((order) => order.token === token);
    },

    getByCode(code: string): Order | undefined {
      return orders.find((order) => order.code === code);
    },

    /** Newest first. */
    listOrders(): Array<Order> {
      return [...orders].reverse();
    },

    /** Customer change before the cut-off, while the order is not final. */
    updateOrder(token: string, patch: UpdateOrderRequest): StoreResult<Order> {
      const order = orders.find((candidate) => candidate.token === token);
      if (!order) return fail('not_found', 'Order not found');
      if (cutoffPassed()) return fail('cutoff_passed', 'Changes are closed');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
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
      return ok(
        replace(
          withAudit(next, { by: { role: 'customer', name: order.firstName }, what: 'edited' }),
        ),
      );
    },

    /** Customer cancel (a change, so refused after the cut-off). */
    cancelOrder(token: string): StoreResult<Order> {
      const order = orders.find((candidate) => candidate.token === token);
      if (!order) return fail('not_found', 'Order not found');
      if (cutoffPassed()) return fail('cutoff_passed', 'Changes are closed');
      if (isFinalStatus(order.status)) return fail('invalid_status', 'This order is closed');
      return ok(
        replace(
          withAudit(
            { ...order, status: 'cancelled' },
            {
              by: { role: 'customer', name: order.firstName },
              what: 'status',
              detail: 'cancelled',
            },
          ),
        ),
      );
    },

    setStatus(code: string, to: OrderStatus, actor: StaffActor): StoreResult<Order> {
      const order = orders.find((candidate) => candidate.code === code);
      if (!order) return fail('not_found', 'Order not found');
      if (!nextStatuses(order).includes(to)) {
        return fail('invalid_status', `Cannot move from ${order.status} to ${to}`);
      }
      return ok(
        replace(withAudit({ ...order, status: to }, { by: actor, what: 'status', detail: to })),
      );
    },

    setPaid(code: string, paid: boolean, actor: StaffActor): StoreResult<Order> {
      const order = orders.find((candidate) => candidate.code === code);
      if (!order) return fail('not_found', 'Order not found');
      return ok(
        replace(
          withAudit(
            { ...order, paid },
            { by: actor, what: 'paid', detail: paid ? 'paid' : 'unpaid' },
          ),
        ),
      );
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

    /** Deterministic sample orders; respects portion limits, ignores the cut-off. Returns the count added. */
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
        const input: CreateOrderRequest = {
          firstName,
          language: random() < 0.5 ? 'en' : 'id',
          lines: requested,
          fulfilment: random() < 0.6 ? 'pickup' : 'delivery',
        };
        const code = uniqueCode(() => generateOrderCode(seededFill));
        const order = insert(input, lines.value, { role: 'customer', name: firstName }, undefined, {
          id: `sample-${String(++idCounter)}`,
          code,
          token: generateToken(seededFill),
        });
        if (random() < 0.4) replace({ ...order, status: 'confirmed' });
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
      orders = [];
    },
  };
}

export type MockStore = ReturnType<typeof createStore>;
