import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { findOrder } from '../../api/customer';
import { lastKitchen } from '../../api/device/lastKitchen';
import { readMyOrders } from '../../api/device/myOrders';
import { ScreenBoundary, isOffline, useLang } from './layout';
import { buildMyOrders } from './myOrdersModel';
import { MyOrdersView, type FindOutcome } from './MyOrdersView';
import { selectList, selectMenus } from './selectors';
import { listRequested } from './slice';

type Props = Readonly<{
  /** Used by the empty state's "Go to the menu" button (the header has no back arrow: tab root). */
  onBack: () => void;
  /** Open the order page for this private token. */
  onOpenOrder: (token: string) => void;
}>;

const NO_ROWS: ReadonlyArray<never> = [];

/** The saved order's token for a parsed code, if this phone has it. */
const findToken = (code: string) => readMyOrders().find((entry) => entry.code === code)?.token;

function MyOrdersContent({ onBack, onOpenOrder }: Props) {
  const lang = useLang();
  // D-075: ask the kitchen the customer is in (the last one visited). The order opens by its token
  // and is saved in My orders when its page loads.
  const onFind = useCallback(
    async (code: string, firstName: string): Promise<FindOutcome> => {
      const slug = lastKitchen();
      // The form isn't shown without a kitchen; never claim "not found" without asking.
      if (slug === null) return 'error';
      const result = await findOrder(slug, code, firstName);
      if (result.ok) {
        onOpenOrder(result.data.token);
        return 'found';
      }
      return result.error === 'locked_out'
        ? 'locked'
        : result.error === 'not_found'
          ? 'not_found'
          : 'error';
    },
    [onOpenOrder],
  );
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const menus = useSelector(selectMenus);
  const kitchenSlug = lastKitchen();
  // The name comes from what this side already has: that kitchen's menu, else one of its orders.
  const kitchenName =
    kitchenSlug === null
      ? null
      : (menus[kitchenSlug]?.kitchen.name ??
        (list.status === 'ready'
          ? list.orders.find((order) => order.seller.slug === kitchenSlug)?.seller.name
          : undefined) ??
        null);

  const load = useCallback(() => {
    dispatch(listRequested());
  }, [dispatch]);
  useEffect(load, [load]);

  const rows = useMemo(
    () =>
      list.status === 'ready'
        ? buildMyOrders({
            orders: list.orders,
            expired: list.expired,
            saved: list.saved,
            menus,
            lang,
            paid: Object.fromEntries(list.orders.map((order) => [order.token, order.paid])),
          })
        : { current: NO_ROWS, earlier: NO_ROWS },
    [list, menus, lang],
  );
  const stale = list.status === 'ready' ? list.stale : undefined;

  return (
    <MyOrdersView
      lang={lang}
      status={list.status === 'ready' ? 'ready' : list.status === 'error' ? 'error' : 'loading'}
      current={rows.current}
      earlier={rows.earlier}
      stale={stale !== undefined}
      offline={isOffline(stale)}
      findToken={findToken}
      onFind={onFind}
      hasKitchen={kitchenSlug !== null}
      kitchenName={kitchenName}
      onOpenOrder={onOpenOrder}
      onOpenMenu={onBack}
      onRetry={load}
    />
  );
}

export function MyOrdersScreen(props: Props) {
  return (
    <ScreenBoundary>
      <MyOrdersContent {...props} />
    </ScreenBoundary>
  );
}
