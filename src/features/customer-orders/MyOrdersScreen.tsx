import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { findOrder } from '../../api/customer';
import { lastKitchen } from '../../api/device/lastKitchen';
import { readMyOrders } from '../../api/device/myOrders';
import { ownKitchen } from '../../components/install';
import { ScreenBoundary, isOffline, useLang } from './layout';
import { buildMyOrders } from './myOrdersModel';
import { MyOrdersView, type FindOutcome } from './MyOrdersView';
import { selectList, selectMenus } from './selectors';
import { listRequested, menuRequested } from './slice';

type Props = Readonly<{
  /** Used by the empty state's "Go to the menu" button (the header has no back arrow: tab root). */
  onBack: () => void;
  /** Open the order page for this private token. */
  onOpenOrder: (token: string) => void;
  /** Plan 102 Q3 (A1): inside a kitchen's installed app, only this kitchen's orders are listed. */
  onlyKitchen?: string | null;
}>;

const NO_ROWS: ReadonlyArray<never> = [];

/** The saved order's token for a parsed code, if this phone has it. */
const findToken = (code: string) => readMyOrders().find((entry) => entry.code === code)?.token;

function MyOrdersContent({ onBack, onOpenOrder, onlyKitchen = null }: Props) {
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

  // The banner is the kitchen the customer came from: the home-screen app's own, else the last one
  // opened (opening an order remembers its kitchen too). Plan 068 follow-up.
  const bannerSlug = ownKitchen() ?? kitchenSlug;
  const bannerMenu = bannerSlug === null ? undefined : menus[bannerSlug];
  // Once the list is in, fetch the menu only when loading the list did not already (it loads the
  // menu of every kitchen with a current order).
  const listCoversBanner =
    list.status === 'ready' &&
    list.orders.some((order) => order.seller.slug === bannerSlug && order.archived !== true);
  const needsBannerMenu =
    bannerSlug !== null &&
    bannerMenu === undefined &&
    (list.status === 'ready' || list.status === 'error') &&
    !listCoversBanner;
  useEffect(() => {
    if (bannerSlug !== null && needsBannerMenu) dispatch(menuRequested(bannerSlug));
  }, [bannerSlug, needsBannerMenu, dispatch]);

  const load = useCallback(() => {
    dispatch(listRequested());
  }, [dispatch]);
  useEffect(load, [load]);

  const rows = useMemo(() => {
    if (list.status !== 'ready') return { current: NO_ROWS, earlier: NO_ROWS };
    const all = buildMyOrders({
      orders: list.orders,
      expired: list.expired,
      saved: list.saved,
      menus,
      lang,
      paid: Object.fromEntries(list.orders.map((order) => [order.token, order.paid])),
    });
    if (onlyKitchen === null) return all;
    // The row's slug comes from the order itself, so an old saved entry without a slug matches once
    // its order is loaded; one that did not load has no row and stays out.
    return {
      current: all.current.filter((row) => row.slug === onlyKitchen),
      earlier: all.earlier.filter((row) => row.slug === onlyKitchen),
    };
  }, [list, menus, lang, onlyKitchen]);
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
      ownKitchen={ownKitchen()}
      hasKitchen={kitchenSlug !== null}
      kitchenName={kitchenName}
      kitchen={bannerMenu?.kitchen}
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
