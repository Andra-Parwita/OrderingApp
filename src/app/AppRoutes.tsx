import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { styled } from 'styled-components';
import { SellerPicker } from '../components/SellerPicker';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { useMediaQuery } from '../components/useMediaQuery';
import {
  BasketScreen,
  MenuScreen,
  OrderPlacedScreen,
  placeReset,
  selectKitchenMissing,
  type CustomerRootState,
} from '../features/customer-menu';
import { MyOrdersScreen, OrderScreen } from '../features/customer-orders';
import { CustomerSettingsScreen } from '../features/customer-settings';
import { CookScreen } from '../features/seller-cook';
import {
  NewOrderScreen,
  OrderDetailScreen,
  OrderPanel,
  OrdersScreen,
  OrdersTableScreen,
  parseStatusFilter,
  type StatusFilter,
} from '../features/seller-orders';
import { SettingsScreen } from '../features/seller-settings';
import { ShareScreen } from '../features/seller-share';
import { CustomerShell } from './CustomerShell';
import { DESKTOP_QUERY } from './layout';
import { isValidSlug } from '../../shared/seller';
import { HomePage, KitchenNotFoundPage, NotFoundPage } from './pages';
import { SellerLayout } from './SellerLayout';

// Route wrappers: the screens only get callbacks; where they lead is decided here.

/** True when the server said this kitchen does not exist. */
function useKitchenMissing(slug: string): boolean {
  return useSelector((state: CustomerRootState) => selectKitchenMissing(state, slug));
}

function MenuRoute() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toBasket = useCallback(() => void navigate(`/${slug}/basket`), [navigate, slug]);
  const missing = useKitchenMissing(slug);
  if (!isValidSlug(slug) || missing) return <KitchenNotFoundPage />;
  return <MenuScreen slug={slug} onViewBasket={toBasket} />;
}

function BasketRoute() {
  const { slug = '' } = useParams();
  const missing = useKitchenMissing(slug);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  // Back goes to where the customer came from; opened directly, it goes to the menu.
  const back = useCallback(() => {
    void (location.key === 'default' ? navigate(`/${slug}`, { replace: true }) : navigate(-1));
  }, [navigate, location.key, slug]);
  const placed = useCallback(
    (token: string) => {
      // Replace, so Back from the confirmation does not return to a basket that is now empty.
      void navigate(`/o/${token}/placed`, { replace: true });
      // Otherwise the next visit to the basket would see the old "placed" result and redirect.
      dispatch(placeReset());
    },
    [navigate, dispatch],
  );
  if (!isValidSlug(slug) || missing) return <KitchenNotFoundPage />;
  return <BasketScreen slug={slug} onBack={back} onPlaced={placed} />;
}

/** "Order placed": the confirmation straight after ordering. Its only exit is the order page. */
function PlacedRoute() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toOrder = useCallback(() => void navigate(`/o/${token ?? ''}`), [navigate, token]);
  if (!token) return <NotFoundPage />;
  return <OrderPlacedScreen key={token} token={token} onChange={toOrder} onBack={toOrder} />;
}

/** The order page: status, updates, change or cancel. Opening the link adds it to My orders. */
function OrderRoute() {
  const { token } = useParams();
  const navigate = useNavigate();
  const back = useCallback(() => void navigate('/my-orders'), [navigate]);
  const change = useCallback((next: string) => void navigate(`/o/${next}/edit`), [navigate]);
  if (!token) return <NotFoundPage />;
  return <OrderScreen key={token} token={token} onBack={back} onChange={change} />;
}

function EditOrderRoute() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toOrder = useCallback(() => void navigate(`/o/${token ?? ''}`), [navigate, token]);
  if (!token) return <NotFoundPage />;
  return (
    <BasketScreen
      key={token}
      editToken={token}
      onBack={toOrder}
      onPlaced={toOrder}
      onUpdated={toOrder}
    />
  );
}

function MyOrdersRoute() {
  const navigate = useNavigate();
  const back = useCallback(() => void navigate('/'), [navigate]);
  const open = useCallback((token: string) => void navigate(`/o/${token}`), [navigate]);
  return <MyOrdersScreen onBack={back} onOpenOrder={open} />;
}

// The seller list's filter and search live in the URL (?status=ready&q=rina): they survive a
// reload and can be shared. Not mirrored in Redux. Opening an order keeps them in the URL, so
// the list beside the detail (desktop) and Back (phone) restore the same view.
function SellerListRoute({
  table = false,
  selectedCode,
}: Readonly<{ table?: boolean; selectedCode?: string }>) {
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
    (code: string) => void navigate(`/seller/orders/${code}${search === '' ? '' : `?${search}`}`),
    [navigate, search],
  );
  const onNewOrder = useCallback(() => void navigate('/seller/new'), [navigate]);
  const onShare = useCallback(() => void navigate('/seller/share'), [navigate]);
  const props = { filter, query, onFilterChange, onQueryChange, onOpenOrder, onNewOrder, onShare };
  return table ? (
    <OrdersTableScreen {...props} selectedCode={selectedCode} />
  ) : (
    <OrdersScreen {...props} />
  );
}

function SellerDetailRoute({ code }: Readonly<{ code: string }>) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const back = useCallback(() => void navigate(`/seller${search}`), [navigate, search]);
  return <OrderDetailScreen key={code} code={code} onBack={back} />;
}

/** The desktop panel: the filter and search stay in the URL, so Close and Back restore the table. */
function SellerPanelRoute({ code }: Readonly<{ code: string }>) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { search } = useLocation();
  const close = useCallback(() => void navigate(`/seller${search}`), [navigate, search]);
  const open = useCallback(
    (next: string) => void navigate(`/seller/orders/${next}${search}`, { replace: true }),
    [navigate, search],
  );
  return (
    <OrderPanel
      code={code}
      filter={parseStatusFilter(params.get('status'))}
      query={params.get('q') ?? ''}
      onClose={close}
      onOpenOrder={open}
    />
  );
}

/** /seller and /seller/orders/:code. A phone shows one page at a time; a desktop, the table with the order in a panel. */
function OrdersWorkspace() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { code } = useParams();
  if (!desktop) return code ? <SellerDetailRoute code={code} /> : <SellerListRoute />;
  return (
    <>
      <SellerListRoute table selectedCode={code} />
      {code ? <SellerPanelRoute code={code} /> : null}
    </>
  );
}

function CookRoute() {
  return <CookScreen desktop={useMediaQuery(DESKTOP_QUERY)} />;
}

function NewOrderRoute() {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const toOrders = useCallback(() => void navigate('/seller'), [navigate]);
  return <NewOrderScreen onBack={toOrders} onDone={toOrders} hideLanguage={desktop} />;
}

const FooterLabel = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const MoreBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const ShareLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.colour.accent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

function SettingsRoute() {
  const { t } = useTranslation();
  return (
    <SettingsScreen>
      <MoreBlock>
        <FooterLabel>{t('theme.label')}</FooterLabel>
        <ThemeSwitch />
        <SellerPicker />
        <ShareLink to="/seller/share">{t('sellerNav.shareMenu')}</ShareLink>
      </MoreBlock>
    </SettingsScreen>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Customer pages share the bottom tab bar (D-039). */}
      <Route element={<CustomerShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/:slug" element={<MenuRoute />} />
        <Route path="/:slug/basket" element={<BasketRoute />} />
        <Route path="/o/:token" element={<OrderRoute />} />
        <Route path="/o/:token/placed" element={<PlacedRoute />} />
        <Route path="/o/:token/edit" element={<EditOrderRoute />} />
        <Route path="/my-orders" element={<MyOrdersRoute />} />
        <Route path="/settings" element={<CustomerSettingsScreen />} />
      </Route>
      {/* Seller routes have no sign-in until phase 4 (D-011); anyone with the link can open them. */}
      <Route path="/seller" element={<SellerLayout />}>
        <Route index element={<OrdersWorkspace />} />
        <Route path="orders/:code" element={<OrdersWorkspace />} />
        <Route path="new" element={<NewOrderRoute />} />
        <Route path="cook" element={<CookRoute />} />
        <Route path="share" element={<ShareScreen />} />
        <Route path="settings" element={<SettingsRoute />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
