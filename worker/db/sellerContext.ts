// Shared pieces of one seller's repository: the dependencies, result helpers, the reads and the
// order rules every group uses (split out of seller.ts, plan 098 C3; the code is unchanged).
import type { ApiErrorCode } from '../../shared/apiError';
import { diffOrder } from '../../shared/auditDiff';
import type {
  Actor,
  AuditEntry,
  InboxEntry,
  KitchenImages,
  MenuItem,
  MenuItemView,
  SellerMenuItemView,
  OrderingState,
  OrderLine,
  OrderStatus,
  Seller,
  SellerOrder,
  StaffActor,
} from '../../shared/domain';
import { IMAGE_SLOTS } from '../../shared/imageSlots';
import { AUDIT_MAX, INBOX_MAX } from '../../shared/limits';
import type { MenuResponse } from '../../shared/menuContract';
import type {
  CreateOrderRequest,
  CreateSellerOrderRequest,
  RequestedLine,
  UpdateOrderRequest,
} from '../../shared/orderContract';
import { type PastWeekSummary } from '../../shared/pastWeeks';
import type { SavedSet } from '../../shared/setupContract';
import type { StoreResult } from '../repo/Repository';
import { type D1Statement } from './d1';
import { MENU_PLACES_SQL, sellerViews, USED_SQL } from './menuView';
import { createMenuOps, type CustomerNotice, type MenuDeps } from './menus';
import {
  changeStatements,
  insertOrderStatements,
  lineNotesChanged,
  LIVE_MENU,
  readLiveOrder,
} from './orders';
import { createDayOps } from './daySales';
import { createPrivateOps } from './private';
import { createHandoverOps } from './handover';
import { createPushOps } from './push';
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
  type DishRow,
  type ImageRow,
  type ItemRow,
  type KitchenRow,
  type MenuRow,
  type PickupRow,
  type SetDishRow,
  type SetImageRow,
  type SetRow,
  type SettingsRow,
} from './rows';
import {
  type Deps,
  fail,
  ok,
  warn,
  type State,
  type StaffInsert,
  type OverLimit,
  type Draft,
} from './sellerShared';

export function createSellerContext(deps: Deps, seller: Seller) {
  const { db } = deps;
  const sid = seller.id;
  const nowIso = () => deps.now().toISOString();
  const { onCustomerChange } = deps;
  const notify = onCustomerChange
    ? (notices: Array<CustomerNotice>): void => {
        onCustomerChange(
          notices.map((notice) => ({
            ...notice,
            sellerId: sid,
            slug: seller.slug,
            kitchenName: seller.name,
          })),
        );
      }
    : undefined;
  const menuDeps: MenuDeps = {
    db,
    now: deps.now,
    newId: deps.newId,
    ...(notify ? { notify } : {}),
  };
  const menuOps = createMenuOps(menuDeps, sid);
  const handover = createHandoverOps(menuDeps, sid);
  const dayOps = createDayOps(menuDeps, sid);
  const privateOps = createPrivateOps(
    {
      db,
      now: deps.now,
      newId: deps.newId,
      newCode: deps.newCode,
      newToken: deps.newToken,
      ...(notify ? { notify } : {}),
    },
    sid,
  );
  const pushOps = createPushOps(db, deps.now, sid);

  // ---- Reading ----

  function usedStatement(exceptOrderId?: string): D1Statement {
    return exceptOrderId === undefined
      ? db.stmt(`${USED_SQL} GROUP BY l.item_id`, sid)
      : db.stmt(`${USED_SQL} AND o.id <> ? GROUP BY l.item_id`, sid, exceptOrderId);
  }

  async function loadState(exceptOrderId?: string): Promise<State> {
    const [kitchens, images, settings, menus, points, items, used, chefs] = await db.reads([
      db.stmt('SELECT * FROM kitchens WHERE seller_id = ?', sid),
      db.stmt('SELECT slot, ref FROM kitchen_images WHERE seller_id = ?', sid),
      db.stmt('SELECT * FROM kitchen_settings WHERE seller_id = ?', sid),
      db.stmt('SELECT * FROM menus WHERE seller_id = ?', sid),
      db.stmt(MENU_PLACES_SQL, sid),
      db.stmt('SELECT * FROM menu_items WHERE seller_id = ? ORDER BY position', sid),
      usedStatement(exceptOrderId),
      db.stmt('SELECT id, name FROM chefs WHERE seller_id = ? ORDER BY position', sid),
    ]);
    const kitchen = kitchens[0] as KitchenRow | undefined;
    const settingsRow = settings[0] as SettingsRow | undefined;
    const menuRow = menus[0] as MenuRow | undefined;
    if (!kitchen || !settingsRow || !menuRow) throw new Error(`Seller ${sid} has no kitchen rows`);
    return {
      kitchen: kitchenOf(sid, kitchen, images as Array<ImageRow>),
      settings: settingsOf(settingsRow, menuRow.taking_orders === 1),
      week: weekOf(menuRow, points as Array<PickupRow>),
      items: (items as Array<ItemRow>).map(itemOf),
      used: new Map(
        (used as Array<{ item_id: string; used: number }>).map((row) => [row.item_id, row.used]),
      ),
      chefs: (chefs as Array<ChefRow>).map((row) => chefOf(sid, row)),
      theme: settingsRow.theme,
      ...(menuRow.picture_ref !== null ? { pictureUrl: menuRow.picture_ref } : {}),
    };
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

  /** plan 001: a saved set is a list of library dishes; `items` is the legacy item-copy view of them. */
  type FullSet = SavedSet & { dishIds: Array<string>; timesUsed: number };

  async function readSets(): Promise<Array<FullSet>> {
    const [sets, links, dishes, images] = await db.reads([
      db.stmt('SELECT * FROM saved_sets WHERE seller_id = ? ORDER BY position', sid),
      db.stmt(
        'SELECT set_id, dish_id FROM saved_set_dishes WHERE seller_id = ? ORDER BY set_id, position',
        sid,
      ),
      db.stmt('SELECT * FROM dishes WHERE seller_id = ?', sid),
      db.stmt('SELECT set_id, slot, ref FROM saved_set_images WHERE seller_id = ?', sid),
    ]);
    const dishById = new Map((dishes as Array<DishRow>).map((dish) => [dish.id, dish]));
    return (sets as Array<SetRow>).map((set) => {
      const dishIds = (links as Array<SetDishRow>)
        .filter((link) => link.set_id === set.id)
        .map((link) => link.dish_id);
      return {
        id: set.id,
        name: set.name,
        dishIds,
        timesUsed: set.times_used,
        items: dishIds.flatMap((dishId) => {
          const dish = dishById.get(dishId);
          return dish ? [setItemOf(dish)] : [];
        }),
        images: imagesOf(
          (images as Array<SetImageRow>).filter((i) => i.set_id === set.id),
          set.banner_background,
          set.image_alt_en,
          set.image_alt_id,
        ),
      };
    });
  }

  // ---- Menu rules ----

  function ordering(s: Pick<State, 'settings' | 'week'>): OrderingState {
    if (seller.paused) return { open: false, reason: 'kitchen_closed' };
    if (!s.settings.orderingOpen) return { open: false, reason: 'closed_by_seller' };
    if (deps.now().getTime() >= Date.parse(s.week.cutoffAt)) {
      return { open: false, reason: 'cutoff_passed' };
    }
    return { open: true };
  }

  /** The error that stops a customer from placing or changing an order, if any. */
  function closedError<T>(s: State): StoreResult<T> | null {
    const state = ordering(s);
    if (state.reason === 'kitchen_closed')
      return fail('kitchen_closed', 'This kitchen is closed for now');
    if (state.reason === 'closed_by_seller') return fail('ordering_closed', 'Ordering is closed');
    if (state.reason === 'cutoff_passed') return fail('cutoff_passed', 'Orders are closed');
    return null;
  }

  /** The customer view: the chef (D-012) and the manual flag are dropped here. */
  function view(seller: SellerMenuItemView): MenuItemView {
    const { dayStock, ...copy } = seller;
    delete copy.chefId;
    delete copy.manualSoldOut;
    // Plan 029: customers see that it is sold at the stall, never how many.
    return dayStock === undefined
      ? copy
      : { ...copy, onTheDay: dayStock > 0 ? ('available' as const) : ('sold_out' as const) };
  }

  function publicMenu(s: State, forSeller = false): MenuResponse {
    // A draft is the seller's private work: customers get the kitchen, no dishes, no ordering.
    const draft = !forSeller && s.week.status !== 'published';
    return {
      seller: { ...seller },
      kitchen: {
        ...s.kitchen,
        ...(s.settings.whatsappNumber ? { whatsappNumber: s.settings.whatsappNumber } : {}),
      },
      week: s.week,
      items: draft ? [] : sellerViews(s.items, s.used).map(view),
      ordering: draft ? { open: false, reason: 'not_published' } : ordering(s),
      theme: s.theme,
      languages: s.settings.languages ?? 'both',
      ...(s.settings.firstLanguage ? { firstLanguage: s.settings.firstLanguage } : {}),
      ...(!draft && s.pictureUrl !== undefined ? { pictureUrl: s.pictureUrl } : {}),
    };
  }

  // ---- Order rules ----

  /** A choice is ordered as `<dish> · <choice>` (plan 111); an empty Indonesian name shows the English one. */
  function snapshot(s: State, item: MenuItem, qty: number): OrderLine {
    const parent =
      item.groupId === undefined ? undefined : s.items.find((p) => p.id === item.groupId);
    if (!parent) {
      return {
        itemId: item.id,
        name: { ...item.name },
        size: { ...item.size },
        priceCents: item.priceCents,
        qty,
      };
    }
    const part = (text: MenuItem['name'], lang: 'en' | 'id') => text[lang] || text.en || text.id;
    return {
      itemId: item.id,
      name: {
        en: `${part(parent.name, 'en')} · ${part(item.name, 'en')}`,
        id: `${part(parent.name, 'id')} · ${part(item.name, 'id')}`,
      },
      size: { ...parent.size },
      priceCents: parent.priceCents,
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
    over: OverLimit = 'refuse',
    keepNotes = false,
  ): StoreResult<Array<OrderLine>> {
    const lines: Array<OrderLine> = [];
    // Customers are refused; a seller-entered order warns (D-062) and `force` lets it pass.
    const tooMany = (code: ApiErrorCode, message: string): StoreResult<Array<OrderLine>> | null =>
      over === 'allow'
        ? null
        : over === 'warn'
          ? warn(code, { code: 'over_limit' }, message)
          : fail(code, message);
    for (const { itemId, qty, note } of requested) {
      const item = s.items.find((candidate) => candidate.id === itemId);
      if (!item) return fail('unknown_item', `Unknown item: ${itemId}`);
      const previous = existing.find((line) => line.itemId === itemId);
      // Plan 111: a dish with choices is ordered through its choices, never by itself.
      if (s.items.some((candidate) => candidate.groupId === itemId)) {
        return fail('pick_choice', `Pick a choice of ${item.name.en || item.name.id}`);
      }
      const parent =
        item.groupId === undefined ? undefined : s.items.find((p) => p.id === item.groupId);
      // Plan 029: an on-the-day-only dish cannot be pre-ordered (an order may keep what it has).
      if (item.preorder === false && (!previous || qty > previous.qty)) {
        return fail('not_preorderable', `${item.name.en || item.name.id} is sold on the day only`);
      }
      // Manually sold out: no new portions (an order may keep what it already has).
      if (
        (item.soldOut === true || parent?.soldOut === true) &&
        (!previous || qty > previous.qty)
      ) {
        const refused = tooMany('sold_out', `${item.name.en || item.name.id} is sold out`);
        if (refused) return refused;
      }
      if (item.limit !== undefined) {
        const left = item.limit - (s.used.get(itemId) ?? 0);
        const refused =
          left <= 0
            ? tooMany('sold_out', `${item.name.en || item.name.id} is sold out`)
            : qty > left
              ? tooMany('exceeds_remaining', `Only ${left} left of ${item.name.en || item.name.id}`)
              : null;
        if (refused) return refused;
      }
      const base = previous ? { ...previous, qty } : snapshot(s, item, qty);
      delete base.note;
      // Plan 111: a note sent with the line wins ('' removes it); otherwise only a seller edit keeps it.
      const kept =
        note === undefined ? (keepNotes ? previous?.note : undefined) : note || undefined;
      lines.push(kept ? { ...base, note: kept } : base);
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

  /**
   * The first statement of a batch that writes order lines (D1 runs a batch in one transaction, so
   * nothing can slip in between this check and the writes). If the lines would take more portions
   * than a limited item has left, it raises "integer overflow" (abs of the smallest integer),
   * which rolls the whole batch back; `isPortionRace` recognises that and the caller answers
   * with the usual "sold out" error. The order's own earlier lines do not count against it.
   */
  function portionGuard(order: SellerOrder): D1Statement | null {
    if (order.status === 'cancelled' || order.lines.length === 0) return null;
    // One JSON parameter, not two per line: D1 allows 100 bound parameters a statement, and a
    // 50-line order (plan 066) would need 102.
    return db.stmt(
      `WITH want (item_id, qty) AS (
         SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?))
       SELECT CASE WHEN EXISTS (
         SELECT 1 FROM want w JOIN menu_items m ON m.seller_id = ? AND m.id = w.item_id
         WHERE m.portion_limit IS NOT NULL AND m.portion_limit < w.qty + COALESCE((
           SELECT SUM(l.qty) FROM order_lines l JOIN orders o ON o.seller_id = l.seller_id AND o.id = l.order_id
           WHERE o.seller_id = m.seller_id AND ${LIVE_MENU} AND o.status <> 'cancelled'
             AND l.item_id = w.item_id AND o.id <> ?), 0)
       ) THEN abs(-9223372036854775808) ELSE 0 END AS guard`,
      JSON.stringify(order.lines.map((line) => [line.itemId, line.qty])),
      sid,
      order.id,
    );
  }

  function isPortionRace(error: unknown): boolean {
    for (let e: unknown = error; e instanceof Error; e = e.cause) {
      if (/integer overflow/i.test(e.message)) return true;
    }
    return false;
  }

  /** The error a customer who lost the race for the last portions gets (the one the app shows). */
  function lostRace<T>(
    s: State,
    requested: Array<RequestedLine>,
    existing?: Array<OrderLine>,
  ): StoreResult<T> {
    const again = buildLines(s, requested, existing);
    return again.ok ? fail('sold_out', 'Sold out') : fail(again.error, again.message);
  }

  /** `force` (D-062, a seller edit that goes over a limit) skips the portion guard, as `place` does. */
  async function commit(d: Draft, force = false): Promise<SellerOrder> {
    const guard = d.linesChanged && !force ? portionGuard(d.order) : null;
    await db.batch([...(guard ? [guard] : []), ...changeStatements(db, d)]);
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
      ...(input.fulfilment === 'pickup' && input.pickupPlaceId !== undefined
        ? { pickupPlaceId: input.pickupPlaceId }
        : {}),
      ...(input.customerCode !== undefined ? { customerCode: input.customerCode } : {}),
      createdAt: at,
      updatedAt: at,
    };
  }

  /** A customer may only pick what the menu offers (pickup needs a pickup point). */
  function fulfilmentRefusal(
    s: State,
    fulfilment: 'pickup' | 'delivery',
  ): StoreResult<never> | null {
    if (fulfilment === 'pickup' && s.week.pickupPoints.length === 0)
      return fail('fulfilment_unavailable', "This menu doesn't offer pickup");
    if (fulfilment === 'delivery' && !s.week.delivery.available)
      return fail('fulfilment_unavailable', "This menu doesn't offer delivery");
    return null;
  }

  /** Demo orders only use what the menu offers: delivery when wanted and available, else pickup. */
  function sampleFulfilment(s: State, wantDelivery: boolean): 'pickup' | 'delivery' {
    if (wantDelivery && s.week.delivery.available) return 'delivery';
    return s.week.pickupPoints.length > 0 || !s.week.delivery.available ? 'pickup' : 'delivery';
  }

  async function place(
    s: State,
    input: CreateOrderRequest | CreateSellerOrderRequest,
    by: Actor,
    enteredBy: StaffActor | undefined,
    extra: StaffInsert,
  ): Promise<StoreResult<SellerOrder>> {
    if (!enteredBy) {
      const refused = fulfilmentRefusal(s, input.fulfilment);
      if (refused) return refused;
    }
    if (
      input.fulfilment === 'pickup' &&
      input.pickupPlaceId !== undefined &&
      !s.week.pickupPoints.some((point) => point.id === input.pickupPlaceId)
    ) {
      return fail('invalid_request', 'Unknown pickup place');
    }
    const over: OverLimit = !enteredBy ? 'refuse' : extra.force === true ? 'allow' : 'warn';
    const lines = buildLines(s, input.lines, [], over);
    if (!lines.ok) return lines;
    const id = deps.newId();
    const code = await uniqueCode(deps.newCode);
    const token = deps.newToken();
    const built = buildOrder(input, lines.value, by, enteredBy, { id, code, token }, extra);
    // Plan 056: a one-language kitchen's orders (and so its push and WhatsApp texts) use it.
    const only = s.settings.languages;
    const order = only === 'en' || only === 'id' ? { ...built, language: only } : built;
    // A forced order takes the portions it asked for, so the race guard must not stop it.
    const guard = over === 'allow' ? null : portionGuard(order);
    try {
      await db.batch([...(guard ? [guard] : []), ...insertOrderStatements(db, order, null)]);
    } catch (error) {
      if (!isPortionRace(error)) throw error;
      return lostRace(await loadState(), input.lines);
    }
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
    const notes = lineNotesChanged(order.lines, next.lines);
    if (!diff && !notes) return null;
    const edited = { ...draft({ ...next, changed: true }), linesChanged: linesChanged || notes };
    return diff
      ? addAudit(edited, { by: { role: 'customer', name: order.firstName }, what: 'edited', diff })
      : edited;
  }

  async function changeByCode(
    code: string,
    change: (order: SellerOrder) => StoreResult<Draft>,
  ): Promise<StoreResult<SellerOrder>> {
    const order = await readLiveOrder(db, sid, 'code', code);
    if (!order) return fail('not_found', 'Order not found');
    const result = change(order);
    if (!result.ok) return result;
    const committed = await commit(result.value);
    // The seller's changes tell the customer something (a status, a message); push it afterwards.
    if (result.value.inboxes.length > 0) {
      notify?.([{ order: committed, entries: result.value.inboxes }]);
    }
    return ok(committed);
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
    picture_ref: string | null;
  };
  type PastItemRow = {
    past_week_id: string;
    item_id: string;
    name_en: string;
    name_id: string;
    qty: number;
  };

  async function readPastWeeks(): Promise<Array<PastWeekSummary>> {
    await dropExpiredDetails(db, deps.now(), sid);
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
      ...(week.picture_ref !== null ? { pictureUrl: week.picture_ref } : {}),
    }));
  }
  return {
    deps,
    db,
    seller,
    sid,
    onCustomerChange,
    nowIso,
    notify,
    menuDeps,
    menuOps,
    handover,
    dayOps,
    privateOps,
    pushOps,
    usedStatement,
    loadState,
    readImages,
    imageStatements,
    readSets,
    ordering,
    closedError,
    view,
    publicMenu,
    snapshot,
    buildLines,
    draft,
    addAudit,
    addInbox,
    withOrder,
    portionGuard,
    isPortionRace,
    lostRace,
    commit,
    uniqueCode,
    buildOrder,
    fulfilmentRefusal,
    sampleFulfilment,
    place,
    patched,
    editDraft,
    changeByCode,
    readPastWeeks,
  };
}

export type SellerContext = ReturnType<typeof createSellerContext>;
