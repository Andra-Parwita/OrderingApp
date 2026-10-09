import { useMemo, type ComponentType } from 'react';
import type { CustomerOrder, InboxEntry, OrderLine, OrderStatus } from '../../../shared/domain';
import type { ExpiredOrder } from '../../../shared/orderContract';
import {
  ArchivedOrderView,
  EarlierOrderView,
  OrderPageView,
  OrderQrView,
  type OrderPageViewProps,
} from '../../features/customer-orders';
import { OrderPlacedView, useLang } from '../../features/customer-menu';
import type { InstallOverride } from '../../components/install';
import { DESKTOP, IPHONE_INSTALLED, IPHONE_SAFARI } from './installEnvironments';
import { menuFrom } from './menuFixtures';
import type { FixtureProps } from './types';

// The order screens (plan 004 stage 4) fed from fixtures.json: the fixture orders are turned into
// the CustomerOrder the API serves, then handed to the real presentational views. Nothing is sent.

const noop = () => undefined;

/** The shape of the entries of `orders` in fixtures.json (they differ from one entry to the next). */
export type FixtureOrder = Readonly<{
  code: string;
  kitchen: string;
  menuDate: string;
  status: string;
  paid?: boolean;
  locked?: boolean;
  firstName?: string;
  note?: string;
  items?: ReadonlyArray<{ dishId?: string; qty: number }>;
  fulfilment?: { type: string };
  collectedAt?: string;
  menuClosed?: boolean;
  messages?: ReadonlyArray<{
    type: string;
    at: string;
    minutes?: number;
    text: { en?: string };
  }>;
}>;

const STATUS: Readonly<Record<string, OrderStatus>> = {
  ordered: 'ordered',
  confirmed: 'confirmed',
  ready: 'ready_for_pickup',
  out: 'out_for_delivery',
  collected: 'collected',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

export function fixtureOrder(props: FixtureProps, index: number): FixtureOrder {
  const orders = props.data.orders as ReadonlyArray<FixtureOrder>;
  const order = orders[index] ?? orders[0];
  if (!order) throw new Error('fixtures.json has no orders');
  return order;
}

function linesFrom(props: FixtureProps, order: FixtureOrder): Array<OrderLine> {
  // The closed orders have no item list: two dishes that add up to their total (15 + 12 = 27).
  const listed = order.items?.filter((item) => item.dishId !== undefined) ?? [];
  const items =
    listed.length > 0
      ? listed
      : [
          { dishId: 'd1', qty: 1 },
          { dishId: 'd5', qty: 1 },
        ];
  const lines: Array<OrderLine> = [];
  for (const item of items) {
    const dish = props.data.menu.dishes.find((candidate) => candidate.id === item.dishId);
    if (dish) {
      lines.push({
        itemId: dish.id,
        name: dish.name,
        size: dish.size,
        priceCents: Math.round(dish.price * 100),
        qty: item.qty,
      });
    }
  }
  return lines;
}

/** The seller's messages as inbox entries; `only` keeps one message type (the screen's state). */
function inboxFrom(order: FixtureOrder, only: string | null): Array<InboxEntry> {
  const entries: Array<InboxEntry> = [];
  for (const message of order.messages ?? []) {
    if (only !== null && message.type !== only) continue;
    if (message.type === 'own_text') {
      entries.push({ at: message.at, kind: 'message', text: message.text.en ?? '' });
    } else if (message.type === 'ready_in') {
      entries.push({
        at: message.at,
        kind: 'message',
        textKey: 'readyIn',
        minutes: message.minutes ?? 0,
      });
    } else {
      entries.push({ at: message.at, kind: 'message', textKey: 'ready' });
    }
  }
  return entries;
}

export function orderFrom(props: FixtureProps, index: number): CustomerOrder {
  const source = fixtureOrder(props, index);
  return {
    id: source.code,
    code: source.code,
    token: `fixture-${source.code}`,
    firstName: source.firstName ?? 'Dewi',
    language: 'en',
    lines: linesFrom(props, source),
    fulfilment: source.fulfilment?.type === 'delivery' ? 'delivery' : 'pickup',
    ...(source.note ? { note: source.note } : {}),
    status: STATUS[source.status] ?? 'ordered',
    locked: source.locked === true,
    paid: source.paid === true,
    inbox: inboxFrom(source, null),
    createdAt: '2026-10-14T19:42:00+10:30',
    updatedAt: '2026-10-14T19:42:00+10:30',
    pickupPlaceId: 'p1',
    ...(source.collectedAt ? { collectedAt: source.collectedAt } : {}),
    seller: { slug: props.data.kitchen.slug, name: props.data.kitchen.cook },
    ...(source.menuClosed ? { archived: true as const, cookingDate: source.menuDate } : {}),
  };
}

/** The first fixture order, with this screen's status and messages (`screenStates`). */
function currentOrder(props: FixtureProps): CustomerOrder {
  const status = props.state['orders[0].status'];
  const only =
    props.state['orders[0].messages'] === 'only the own_text message' ? 'own_text' : null;
  const base = orderFrom(props, 0);
  return {
    ...base,
    status: typeof status === 'string' ? (STATUS[status] ?? base.status) : base.status,
    inbox: inboxFrom(fixtureOrder(props, 0), only),
  };
}

function useOrder(props: FixtureProps) {
  const lang = useLang();
  const menu = useMemo(() => menuFrom(props), [props]);
  const order = useMemo(() => currentOrder(props), [props]);
  return { lang, menu, order, paid: fixtureOrder(props, 0).paid === true };
}

function Placed(props: FixtureProps) {
  const { menu, order } = useOrder(props);
  return (
    <OrderPlacedView
      order={{ ...order, status: 'ordered', inbox: [] }}
      menu={menu}
      returning={false}
      onWhatsApp={noop}
      onShowQr={noop}
      onViewOrder={noop}
      onChange={noop}
      install={{ env: IPHONE_SAFARI }}
    />
  );
}

function Qr(props: FixtureProps) {
  const { lang, menu, order } = useOrder(props);
  return <OrderQrView order={order} menu={menu} lang={lang} onBack={noop} />;
}

function pageProps(
  base: Pick<OrderPageViewProps, 'order' | 'menu' | 'lang' | 'paid'>,
  patch: Partial<OrderPageViewProps> = {},
): OrderPageViewProps {
  return {
    ...base,
    cancelOpen: false,
    cancelling: false,
    collecting: false,
    onBack: noop,
    onShowQr: noop,
    onChange: noop,
    onAskCancel: noop,
    onKeepOrder: noop,
    onCancel: noop,
    onCollect: noop,
    onWhatsApp: noop,
    // The design's phone is an iPhone in Safari: "Notifications are off · Turn on".
    install: { env: IPHONE_SAFARI },
    ...patch,
  };
}

function Page(props: FixtureProps) {
  return <OrderPageView {...pageProps(useOrder(props))} />;
}

/** The order page on a device where notifications are in this state (stage 7: notify-*, desktop). */
const pageOn = (install: InstallOverride): ComponentType<FixtureProps> =>
  function NotifyPage(props) {
    return <OrderPageView {...pageProps(useOrder(props), { install })} />;
  };

function CancelConfirm(props: FixtureProps) {
  const { order, ...rest } = useOrder(props);
  return (
    <OrderPageView
      {...pageProps(
        { ...rest, order: { ...order, status: 'confirmed', inbox: [] } },
        { cancelOpen: true },
      )}
    />
  );
}

function Earlier(props: FixtureProps) {
  const { lang, menu } = useOrder(props);
  const order = useMemo(
    () => ({
      ...orderFrom(props, 2),
      inbox: [{ at: '2026-10-10T14:00:00+10:30', kind: 'message' as const, textKey: 'ready' }],
    }),
    [props],
  );
  return (
    <EarlierOrderView order={order} menu={menu} lang={lang} paid onBack={noop} onOpenMenu={noop} />
  );
}

function Archived(props: FixtureProps) {
  const { lang, menu } = useOrder(props);
  const source = fixtureOrder(props, 4);
  const order: ExpiredOrder = {
    archived: true,
    expired: true,
    token: 'fixture-archived',
    seller: { slug: props.data.kitchen.slug, name: props.data.kitchen.name },
    cookingDate: source.menuDate,
  };
  return (
    <ArchivedOrderView
      order={order}
      code={source.code}
      kitchenName={menu.kitchen.name}
      logoSrc={menu.kitchen.images?.railImage ?? undefined}
      lang={lang}
      onBack={noop}
      onOpenMenu={noop}
    />
  );
}

export const ORDER_FIXTURE_SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  'order-placed': Placed,
  'order-qr': Qr,
  'order-confirmed': Page,
  'order-ready': Page,
  'order-cancel-confirm': CancelConfirm,
  'order-earlier': Earlier,
  'order-archived': Archived,
  // An installed iPhone: the "Last step" card; once allowed, the green banner.
  'notify-off': pageOn({ env: IPHONE_INSTALLED }),
  'notify-on': pageOn({ env: { ...IPHONE_INSTALLED, permission: 'granted' }, subscribed: true }),
  // The quiet line on a computer.
  desktop: pageOn({ env: DESKTOP }),
};
