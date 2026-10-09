import type {
  Chef,
  Fulfilment,
  LocalText,
  Order,
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

export type CookWho = { code: string; firstName: string; qty: number; fulfilment: Fulfilment };

export type CookRow = {
  itemId: string;
  name: LocalText;
  size: LocalText;
  qty: number;
  /** Only set where `qty` is the item's whole total (group by item or chef). */
  limit?: number;
  who: Array<CookWho>;
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
        ...(limit !== undefined ? { limit } : {}),
        who: [],
      };
      byItem.set(line.itemId, row);
    }
    row.qty += line.qty;
    row.who.push({
      code: formatOrderCode(order.code),
      firstName: order.firstName,
      qty: line.qty,
      fulfilment: order.fulfilment,
    });
  }
  // Menu order first; items no longer on the menu (D-020 snapshots) last.
  return [...byItem.values()].sort(
    (a, b) =>
      (menuIndex.get(a.itemId) ?? Number.MAX_SAFE_INTEGER) -
      (menuIndex.get(b.itemId) ?? Number.MAX_SAFE_INTEGER),
  );
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
        const itemId = order.lines[lineIndex]?.itemId;
        const chefId = menu?.items.find((item) => item.id === itemId)?.chefId;
        return menu?.chefs.some((chef) => chef.id === chefId) ? chefId : undefined;
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
