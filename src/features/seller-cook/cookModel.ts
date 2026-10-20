import type {
  Chef,
  Fulfilment,
  LocalText,
  Order,
  OrderLine,
  PickupPoint,
  SellerMenuItemView,
} from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';

// Pure cook-list maths. Every number here is derived from the order list, so it agrees with it:
// cancelled orders never count, and "Confirmed only" also leaves out orders still at Ordered.

export type CountMode = 'all' | 'confirmed';
export type GroupBy = 'item' | 'chef' | 'customer' | 'fulfilment';

export type CookMenu = {
  kitchenName: string;
  cookingDate: string;
  items: Array<SellerMenuItemView>;
  chefs: Array<Chef>;
  /** The menu's pickup places, for the Pack tab. */
  pickupPoints?: Array<PickupPoint>;
};

export type CookWho = {
  code: string;
  firstName: string;
  qty: number;
  fulfilment: Fulfilment;
  /** Plan 081: from a private order (its page is under Private). */
  private?: true;
};

/** Plan 111: a note typed on one order line. */
export type CookLineNote = { code: string; firstName: string; note: string };

export type CookRow = {
  itemId: string;
  name: LocalText;
  size: LocalText;
  qty: number;
  /** Plan 081: how many of `qty` come from private orders (0 = none). */
  privateQty: number;
  /** Only set where `qty` is the item's whole total (group by item or chef). */
  limit?: number;
  who: Array<CookWho>;
  /** Plan 111: line notes of this row (a choice's own row for a choice). */
  notes?: Array<CookLineNote>;
  /** Plan 111: the heading row of a dish with choices; `qty` is the total of its choices. */
  group?: true;
  /** Plan 111: a choice, shown indented under its group row; `name` is the choice's own name. */
  choice?: true;
};

export type CookGroup = {
  key: string;
  /** null: no heading. A `fulfilment` group is headed with a translated word instead. */
  title: string | null;
  fulfilment?: Fulfilment;
  rows: Array<CookRow>;
};

export type CookStats = {
  orders: number;
  incomeCents: number;
  paidCents: number;
  unpaidCents: number;
};

export type CookNote = { code: string; firstName: string; note: string };

export function orderTotalCents(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

export function countedOrders(orders: ReadonlyArray<Order>, mode: CountMode): Array<Order> {
  return orders.filter(
    (order) => order.status !== 'cancelled' && (mode === 'all' || order.status !== 'ordered'),
  );
}

export function cookStats(counted: ReadonlyArray<Order>): CookStats {
  let incomeCents = 0;
  let paidCents = 0;
  for (const order of counted) {
    const total = orderTotalCents(order);
    incomeCents += total;
    if (order.paid) paidCents += total;
  }
  return { orders: counted.length, incomeCents, paidCents, unpaidCents: incomeCents - paidCents };
}

export function cookNotes(counted: ReadonlyArray<Order>): Array<CookNote> {
  const notes: Array<CookNote> = [];
  for (const order of counted) {
    const note = order.note?.trim();
    if (note) notes.push({ code: formatOrderCode(order.code), firstName: order.firstName, note });
  }
  return notes;
}

/** 'all', 'seller' (dishes without a chef, D-012) or `chef-<id>`. */
export type ChefFilter = string;
export const ALL_CHEFS: ChefFilter = 'all';

/** Plan 081: a private order's line carries its own chef (its dish may not be on the menu). */
type ChefLine = { itemId: OrderLine['itemId']; chefId?: OrderLine['chefId'] };

/** The chef id of a line: its own (private order), else its menu item's; undefined = the kitchen. */
function chefIdOf(menu: CookMenu | null, line: ChefLine): string | undefined {
  const chefId = line.chefId ?? menu?.items.find((item) => item.id === line.itemId)?.chefId;
  return menu?.chefs.some((chef) => chef.id === chefId) ? chefId : undefined;
}

/** Who makes a dish: 'seller' for no chef (or one no longer on the menu), else `chef-<id>`. */
export function chefKey(menu: CookMenu | null, line: ChefLine): ChefFilter {
  const chefId = chefIdOf(menu, line);
  return chefId === undefined ? 'seller' : `chef-${chefId}`;
}

/** The filter choices after "All": the kitchen itself, then each chef. Empty when no chefs. */
export function chefChoices(menu: CookMenu | null): Array<{ value: ChefFilter; label: string }> {
  if (!menu || menu.chefs.length === 0) return [];
  return [
    { value: 'seller', label: menu.kitchenName },
    ...menu.chefs.map((chef) => ({ value: `chef-${chef.id}`, label: chef.name })),
  ];
}

/** Does this dish belong to the chosen chef? Always true for 'all'. */
export function isOwnItem(menu: CookMenu | null, filter: ChefFilter, line: ChefLine): boolean {
  return filter === ALL_CHEFS || chefKey(menu, line) === filter;
}

/** Orders cut down to the chosen chef's lines; orders left with none are dropped. */
export function filterByChef(
  orders: ReadonlyArray<Order>,
  menu: CookMenu | null,
  filter: ChefFilter,
): ReadonlyArray<Order> {
  if (filter === ALL_CHEFS) return orders;
  return orders.flatMap((order) => {
    const lines = order.lines.filter((line) => isOwnItem(menu, filter, line));
    return lines.length > 0 ? [{ ...order, lines }] : [];
  });
}

type Pick = { order: Order; lineIndex: number };

function rowsFrom(
  picks: ReadonlyArray<Pick>,
  menu: CookMenu | null,
  withLimit: boolean,
): Array<CookRow> {
  const menuIndex = new Map(menu?.items.map((item, index) => [item.id, index]));
  const byItem = new Map<string, CookRow>();
  for (const { order, lineIndex } of picks) {
    const line = order.lines[lineIndex];
    if (!line) continue;
    let row = byItem.get(line.itemId);
    if (!row) {
      const limit = withLimit
        ? menu?.items.find((item) => item.id === line.itemId)?.limit
        : undefined;
      row = {
        itemId: line.itemId,
        name: line.name,
        size: line.size,
        qty: 0,
        privateQty: 0,
        ...(limit !== undefined ? { limit } : {}),
        who: [],
      };
      byItem.set(line.itemId, row);
    }
    row.qty += line.qty;
    if (line.note) {
      row.notes = [
        ...(row.notes ?? []),
        { code: formatOrderCode(order.code), firstName: order.firstName, note: line.note },
      ];
    }
    if (order.private) row.privateQty += line.qty;
    row.who.push({
      code: formatOrderCode(order.code),
      firstName: order.firstName,
      qty: line.qty,
      fulfilment: order.fulfilment,
      ...(order.private ? { private: true as const } : {}),
    });
  }
  // Menu order first; items no longer on the menu (D-020 snapshots) last.
  const sorted = [...byItem.values()].sort(
    (a, b) =>
      (menuIndex.get(a.itemId) ?? Number.MAX_SAFE_INTEGER) -
      (menuIndex.get(b.itemId) ?? Number.MAX_SAFE_INTEGER),
  );
  return withChoiceGroups(sorted, menu);
}

/**
 * Plan 111: the rows of one dish's choices get a heading row with their total, and show the
 * choice's own name. A choice whose menu item is not known stays a plain row ("Dish · Choice").
 */
function withChoiceGroups(rows: Array<CookRow>, menu: CookMenu | null): Array<CookRow> {
  const items = menu?.items ?? [];
  const out: Array<CookRow> = [];
  const heads = new Map<string, CookRow>();
  for (const row of rows) {
    const choiceItem = items.find((item) => item.id === row.itemId);
    const parent = choiceItem?.groupId
      ? items.find((item) => item.id === choiceItem.groupId)
      : null;
    if (!choiceItem || !parent) {
      out.push(row);
      continue;
    }
    let head = heads.get(parent.id);
    if (!head) {
      head = {
        itemId: parent.id,
        name: parent.name,
        size: parent.size,
        qty: 0,
        privateQty: 0,
        who: [],
        group: true,
      };
      heads.set(parent.id, head);
      out.push(head);
    }
    head.qty += row.qty;
    head.privateQty += row.privateQty;
    out.push({ ...row, name: choiceItem.name, size: { en: '', id: '' }, choice: true });
  }
  return out;
}

function allPicks(orders: ReadonlyArray<Order>): Array<Pick> {
  return orders.flatMap((order) => order.lines.map((_, lineIndex) => ({ order, lineIndex })));
}

export function cookGroups(
  counted: ReadonlyArray<Order>,
  menu: CookMenu | null,
  groupBy: GroupBy,
): Array<CookGroup> {
  const picks = allPicks(counted);
  if (picks.length === 0) return [];
  switch (groupBy) {
    case 'item':
      return [{ key: 'all', title: null, rows: rowsFrom(picks, menu, true) }];
    case 'chef': {
      const chefOf = ({ order, lineIndex }: Pick): string | undefined => {
        const line = order.lines[lineIndex];
        return line ? chefIdOf(menu, line) : undefined;
      };
      const groups: Array<CookGroup> = [];
      // Items without a chef belong to the seller: they group under the kitchen name (D-012).
      const seller = picks.filter((pick) => chefOf(pick) === undefined);
      if (seller.length > 0) {
        groups.push({
          key: 'seller',
          title: menu?.kitchenName ?? '',
          rows: rowsFrom(seller, menu, true),
        });
      }
      for (const chef of menu?.chefs ?? []) {
        const own = picks.filter((pick) => chefOf(pick) === chef.id);
        if (own.length > 0) {
          groups.push({
            key: `chef-${chef.id}`,
            title: chef.name,
            rows: rowsFrom(own, menu, true),
          });
        }
      }
      return groups;
    }
    case 'customer':
      return counted
        .filter((order) => order.lines.length > 0)
        .map((order) => ({
          key: order.id,
          title: `${order.firstName} · ${formatOrderCode(order.code)}`,
          rows: rowsFrom(
            order.lines.map((_, lineIndex) => ({ order, lineIndex })),
            menu,
            false,
          ),
        }));
    case 'fulfilment':
      return (['pickup', 'delivery'] as const).flatMap((fulfilment) => {
        const own = picks.filter(({ order }) => order.fulfilment === fulfilment);
        return own.length > 0
          ? [{ key: fulfilment, title: null, fulfilment, rows: rowsFrom(own, menu, false) }]
          : [];
      });
    default: {
      const unreachable: never = groupBy;
      return unreachable;
    }
  }
}
