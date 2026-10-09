import { useMemo, type ComponentType } from 'react';
import type { CustomerOrder, OrderLine } from '../../../shared/domain';
import type { ExpiredOrder } from '../../../shared/orderContract';
import { CustomerSettingsView } from '../../features/customer-settings';
import { MyOrdersView, buildMyOrders } from '../../features/customer-orders';
import { useLang } from '../../features/customer-menu';
import { ANDROID_CHROME } from './installEnvironments';
import { menuFrom } from './menuFixtures';
import { fixtureOrder, orderFrom } from './orderFixtures';
import type { FixtureProps } from './types';

// My orders and Settings (plan 004 stage 5) fed from fixtures.json: the fixture orders become the
// CustomerOrder the API serves, go through the same row builder as the app, and are drawn by the
// real views. Nothing is sent or saved.

const noop = () => undefined;

/** Order 0 is the current Onde Onde order, 1 a Dapur Bu Rina one, 2 and 3 closed, 4 archived. */
const OTHER_KITCHEN = { slug: 'dapur-bu-rina', name: 'Dapur Bu Rina' } as const;

function line(name: string, qty: number, priceCents: number, itemId: string): OrderLine {
  return {
    itemId,
    name: { en: name, id: name },
    size: { en: '1 box', id: '1 kotak' },
    priceCents,
    qty,
  };
}

function orders(props: FixtureProps): {
  orders: Array<CustomerOrder>;
  expired: Array<ExpiredOrder>;
  paid: Record<string, boolean>;
} {
  const paid: Record<string, boolean> = {};
  const withKitchen = (index: number, patch: Partial<CustomerOrder> = {}): CustomerOrder => {
    const source = fixtureOrder(props, index);
    const base = orderFrom(props, index);
    const order: CustomerOrder = {
      ...base,
      seller: { slug: base.seller.slug, name: source.kitchen },
      ...patch,
    };
    if (source.paid !== undefined) paid[order.token] = source.paid;
    return order;
  };
  const closed = (index: number, cents: number): CustomerOrder =>
    withKitchen(index, {
      archived: true,
      cookingDate: fixtureOrder(props, index).menuDate,
      lines: [line('Order', 1, cents, 'd1')],
    });
  const rina = withKitchen(1, {
    seller: OTHER_KITCHEN,
    lines: [line('Rendang', 2, 1400, 'r1'), line('Sayur lodeh', 1, 800, 'r2')],
  });
  const archivedSource = fixtureOrder(props, 4);
  return {
    orders: [withKitchen(0), rina, closed(2, 2700), closed(3, 1500)],
    expired: [
      {
        archived: true,
        expired: true,
        token: 'fixture-archived',
        seller: { slug: props.data.kitchen.slug, name: props.data.kitchen.name },
        cookingDate: archivedSource.menuDate,
      },
    ],
    paid,
  };
}

function Orders({ props, empty }: Readonly<{ props: FixtureProps; empty: boolean }>) {
  const lang = useLang();
  const rows = useMemo(() => {
    if (empty) return { current: [], earlier: [] };
    const data = orders(props);
    const menu = menuFrom(props);
    const rinaMenu = {
      ...menu,
      seller: { ...menu.seller, slug: OTHER_KITCHEN.slug },
      week: { ...menu.week, cookingDate: '2026-10-18' },
    };
    return buildMyOrders({
      orders: data.orders,
      expired: data.expired,
      saved: [
        {
          code: fixtureOrder(props, 4).code,
          token: 'fixture-archived',
          placedAt: '2026-09-01T00:00:00Z',
        },
      ],
      menus: { [props.data.kitchen.slug]: menu, [OTHER_KITCHEN.slug]: rinaMenu },
      lang,
      paid: data.paid,
      now: new Date(props.data.today),
    });
  }, [props, empty, lang]);
  return (
    <MyOrdersView
      lang={lang}
      status="ready"
      current={rows.current}
      earlier={rows.earlier}
      stale={false}
      offline={false}
      findToken={() => undefined}
      onOpenOrder={noop}
      onOpenMenu={noop}
      onRetry={noop}
    />
  );
}

function MyOrders(props: FixtureProps) {
  return <Orders props={props} empty={false} />;
}

function MyOrdersEmpty(props: FixtureProps) {
  return <Orders props={props} empty />;
}

function Settings() {
  const lang = useLang();
  // The design's Android Chrome: updates already on, and the browser offering its own Install.
  return (
    <CustomerSettingsView
      lang={lang}
      onLang={noop}
      theme="auto"
      onTheme={noop}
      install={{ env: { ...ANDROID_CHROME, permission: 'granted' }, subscribed: true }}
      canInstall
    />
  );
}

export const ACCOUNT_FIXTURE_SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  'my-orders': MyOrders,
  'my-orders-empty': MyOrdersEmpty,
  'android-settings': Settings,
};
