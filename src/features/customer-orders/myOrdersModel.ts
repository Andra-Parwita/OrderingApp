import type { CustomerOrder, Fulfilment, Language, OrderStatus } from '../../../shared/domain';
import { formatCookingDate, formatDay } from '../../../shared/dates';
import type { MenuResponse } from '../../../shared/menuContract';
import type { ExpiredOrder } from '../../../shared/orderContract';
import { pickText } from '../../../shared/text';
import { hasUnseenUpdate, type SavedOrder } from '../../api/device/myOrders';
import { isThisWeek, orderTotalCents } from './helpers';
import { orderInfo } from './orderInfo';

// What the My orders rows show, worked out from the orders, each kitchen's menu and this phone's
// saved entries. Pure: the view only draws it, and the fixtures page builds it from fixtures.json.

/** A current order: the full two-line row with status chips (spec §4.5). */
export type CurrentRow = Readonly<{
  token: string;
  code: string;
  kitchen: string;
  /** "2 × Lime-leaf rice, 1 × Kue lapis". */
  summary: string;
  /** "Sat 17 Oct". */
  dayText: string;
  fulfilment: Fulfilment;
  /** The pickup place, when the kitchen's menu is loaded. */
  place: string | undefined;
  totalCents: number;
  status: OrderStatus;
  locked: boolean;
  /** Paid or not, when it is known; undefined shows no pill. */
  paid: boolean | undefined;
  unseen: boolean;
}>;

/** An earlier order, or an archived one (only whose it was and when): one compact line. */
export type EarlierRow = Readonly<{
  token: string;
  /** Archived entries take it from this phone's saved list. */
  code: string | undefined;
  kitchen: string;
  dayText: string;
  /** None once archived. */
  totalCents: number | undefined;
  status: OrderStatus | 'archived';
}>;

export type MyOrdersModel = Readonly<{
  current: ReadonlyArray<CurrentRow>;
  earlier: ReadonlyArray<EarlierRow>;
}>;

type Input = Readonly<{
  orders: ReadonlyArray<CustomerOrder>;
  expired: ReadonlyArray<ExpiredOrder>;
  saved: ReadonlyArray<SavedOrder>;
  /** Each kitchen's current menu by seller slug; a kitchen that did not load is absent. */
  menus: Readonly<Record<string, MenuResponse | undefined>>;
  lang: Language;
  /** Paid by order token, where the phone knows it. */
  paid?: Readonly<Record<string, boolean>>;
  now?: Date;
}>;

/**
 * Current is by the cook's date in Melbourne (D-044): a closed week's order is always earlier,
 * and shows the date of its own week.
 */
export function buildMyOrders({
  orders,
  expired,
  saved,
  menus,
  lang,
  paid,
  now,
}: Input): MyOrdersModel {
  const current: Array<CurrentRow> = [];
  const earlier: Array<EarlierRow> = [];
  for (const order of orders) {
    const menu = menus[order.seller.slug];
    const cooking = menu?.week.cookingDate ?? null;
    const isCurrent = order.archived !== true && isThisWeek(order, cooking, now);
    if (isCurrent) {
      const info = orderInfo(order, menu, lang);
      current.push({
        token: order.token,
        code: order.code,
        kitchen: order.seller.name,
        summary: order.lines.map((line) => `${line.qty} × ${pickText(line.name, lang)}`).join(', '),
        dayText:
          cooking !== null ? formatCookingDate(cooking, lang) : formatDay(order.createdAt, lang),
        fulfilment: order.fulfilment,
        place: info.place,
        totalCents: orderTotalCents(order),
        status: order.status,
        locked: order.locked,
        paid: paid?.[order.token],
        unseen: hasUnseenUpdate(
          order,
          saved.find((entry) => entry.token === order.token),
        ),
      });
    } else {
      const date = order.archived === true ? (order.cookingDate ?? null) : null;
      earlier.push({
        token: order.token,
        code: order.code,
        kitchen: order.seller.name,
        dayText: date !== null ? formatCookingDate(date, lang) : formatDay(order.createdAt, lang),
        totalCents: orderTotalCents(order),
        status: order.status,
      });
    }
  }
  for (const order of expired) {
    earlier.push({
      token: order.token,
      code: saved.find((entry) => entry.token === order.token)?.code,
      kitchen: order.seller.name,
      dayText: formatCookingDate(order.cookingDate, lang),
      totalCents: undefined,
      status: 'archived',
    });
  }
  return { current, earlier };
}
