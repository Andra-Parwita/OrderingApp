import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { BasketScreen, MenuScreen, OrderPlacedScreen, placeReset } from '../features/customer-menu';
import {
  OrderDetailScreen,
  OrdersScreen,
  parseStatusFilter,
  type StatusFilter,
} from '../features/seller-orders';
import { MyOrdersPage, NotFoundPage } from './pages';

// Route wrappers: the screens only get callbacks; where they lead is decided here.

const noop = () => undefined;

function MenuRoute() {
  const navigate = useNavigate();
  const toBasket = useCallback(() => void navigate('/basket'), [navigate]);
  const toMyOrders = useCallback(() => void navigate('/my-orders'), [navigate]);
  return <MenuScreen onViewBasket={toBasket} onMyOrders={toMyOrders} />;
}

function BasketRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  // Back goes to where the customer came from; opened directly, it goes to the menu.
  const back = useCallback(() => {
    void (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1));
  }, [navigate, location.key]);
  const placed = useCallback(
    (token: string) => {
      // Replace, so Back from the order page does not return to a basket that is now empty.
      void navigate(`/o/${token}`, { replace: true });
      // Otherwise the next visit to the basket would see the old "placed" result and redirect.
      dispatch(placeReset());
    },
    [navigate, dispatch],
  );
  return <BasketScreen onBack={back} onPlaced={placed} />;
}

function OrderRoute() {
  const { token } = useParams();
  if (!token) return <NotFoundPage />;
  // "Change or cancel" arrives in batch 2.
  return <OrderPlacedScreen key={token} token={token} onChange={noop} />;
}

/** What the order detail remembers about the list it came from, so Back restores it. */
type FromList = Readonly<{ search: string }>;

function isFromList(value: unknown): value is FromList {
  return typeof value === 'object' && value !== null && 'search' in value;
}

// The seller list's filter and search live in the URL (?status=ready&q=rina): they survive a
// reload and can be shared. Not mirrored in Redux.
function SellerListRoute() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = parseStatusFilter(params.get('status'));
  const query = params.get('q') ?? '';
  const search = params.toString();

  const setParam = useCallback(
    (key: string, value: string, empty: string) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value === empty) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const onFilterChange = useCallback(
    (next: StatusFilter) => setParam('status', next, 'all'),
    [setParam],
  );
  const onQueryChange = useCallback((next: string) => setParam('q', next, ''), [setParam]);
  const onOpenOrder = useCallback(
    (code: string) => {
      const state: FromList = { search: search === '' ? '' : `?${search}` };
      void navigate(`/seller/orders/${code}`, { state });
    },
    [navigate, search],
  );
  return (
    <OrdersScreen
      filter={filter}
      query={query}
      onFilterChange={onFilterChange}
      onQueryChange={onQueryChange}
      onOpenOrder={onOpenOrder}
    />
  );
}

function SellerDetailRoute() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const search = isFromList(state) ? state.search : '';
  const back = useCallback(() => void navigate(`/seller${search}`), [navigate, search]);
  if (!code) return <NotFoundPage />;
  return <OrderDetailScreen key={code} code={code} onBack={back} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MenuRoute />} />
      <Route path="/basket" element={<BasketRoute />} />
      <Route path="/o/:token" element={<OrderRoute />} />
      <Route path="/my-orders" element={<MyOrdersPage />} />
      {/* Seller routes have no sign-in until phase 4 (D-011); anyone with the link can open them. */}
      <Route path="/seller" element={<SellerListRoute />} />
      <Route path="/seller/orders/:code" element={<SellerDetailRoute />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
