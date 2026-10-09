import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { readMyOrders } from '../../api/device/myOrders';
import { ScreenBoundary, isOffline, useLang } from './layout';
import { buildMyOrders } from './myOrdersModel';
import { MyOrdersView } from './MyOrdersView';
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
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const menus = useSelector(selectMenus);

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
