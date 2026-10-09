import { useCallback, type ReactNode } from 'react';
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
import { BackupScreen, PastWeeksScreen } from '../features/seller-history';
import { LabelsScreen } from '../features/seller-labels';
import {
  ItemEditor,
  MenuScreen as SellerMenuScreen,
  PastePostScreen,
  SavedSetsScreen,
} from '../features/seller-menu';
import { SettingsScreen } from '../features/seller-settings';
import { ChefsScreen, ImagesScreen, WeekSettingsScreen } from '../features/seller-setup';
import { DevicesScreen } from '../features/seller-auth';
import { DeliveryRunScreen, HandOverScreen, SendUpdateScreen } from '../features/seller-saturday';
import { ShareScreen } from '../features/seller-share';
import { Button, ListRow, PageHeader } from '../ui';
import {
  AdminHomeRoute,
  AdminSetupRoute,
  AdminSignInRoute,
  SellerSetupRoute,
  SellerSignInRoute,
} from './AuthRoutes';
import { AdminGuard, SellerGuard, SellerOnly } from './guards';
import { SessionProvider, useSession } from './session';
import { CustomerShell } from './CustomerShell';
import { DESKTOP_QUERY } from './layout';
import { isValidSlug } from '../../shared/seller';
import { HomePage, KitchenNotFoundPage, NotFoundPage } from './pages';
import { SellerLayout } from './SellerLayout';
import { SellerPreview } from './SellerPreview';

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
  const { me } = useSession();
  return (
    <SettingsScreen>
      <MoreBlock>
        <FooterLabel>{t('theme.label')}</FooterLabel>
        <ThemeSwitch />
        {me === null ? <SellerPicker /> : null}
        <ShareLink to="/seller/share">{t('sellerNav.shareMenu')}</ShareLink>
      </MoreBlock>
    </SettingsScreen>
  );
}

/** A seller page opened from More: the screen under a header whose back arrow returns to More. */
function MorePage({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useCallback(() => void navigate('/seller/more'), [navigate]);
  return (
    <>
      <PageHeader title={title} titleHidden backLabel={t('sellerNav.backToMore')} onBack={back} />
      {children}
    </>
  );
}

function WeekRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.weekSettings')}>
      <WeekSettingsScreen settingsHref="/seller/settings" />
    </MorePage>
  );
}
function ImagesRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.images')}>
      <ImagesScreen />
    </MorePage>
  );
}
function ChefsRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.chefs')}>
      <ChefsScreen />
    </MorePage>
  );
}
function LabelsRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.labels')}>
      <LabelsScreen />
    </MorePage>
  );
}
function PastWeeksRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.pastWeeks')}>
      <PastWeeksScreen />
    </MorePage>
  );
}
function BackupRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.backup')}>
      <BackupScreen />
    </MorePage>
  );
}

const MORE_LINKS = [
  ['settings', '/seller/settings'],
  ['weekSettings', '/seller/week'],
  ['images', '/seller/images'],
  ['chefs', '/seller/chefs'],
  ['labels', '/seller/labels'],
  ['pastWeeks', '/seller/past-weeks'],
  ['backup', '/seller/backup'],
  ['shareMenu', '/seller/share'],
  ['devices', '/seller/devices'],
] as const;
// What the server closes to a chef (D-013); the chef does not see these.
const CHEF_HIDDEN: ReadonlySet<string> = new Set([
  'settings',
  'weekSettings',
  'images',
  'chefs',
  'backup',
]);

function DevicesRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { adopt } = useSession();
  const signedOut = useCallback(() => {
    adopt(null);
    void navigate('/seller/sign-in', { replace: true });
  }, [adopt, navigate]);
  return (
    <MorePage title={t('sellerNav.devices')}>
      <DevicesScreen onSignedOut={signedOut} />
    </MorePage>
  );
}

function MoreRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, end } = useSession();
  const links = MORE_LINKS.filter(
    ([key]) => (me?.role !== 'chef' || !CHEF_HIDDEN.has(key)) && (key !== 'devices' || me !== null),
  );
  const signOutNow = useCallback(async () => {
    await end();
    void navigate('/seller/sign-in', { replace: true });
  }, [end, navigate]);
  return (
    <>
      <PageHeader title={t('sellerNav.moreTitle')} />
      <nav aria-label={t('sellerNav.moreTitle')}>
        {links.map(([key, to]) => (
          <ListRow
            key={key}
            primary={t(`sellerNav.${key}`)}
            trailing="›"
            onClick={() => void navigate(to)}
          />
        ))}
      </nav>
      {me === null ? null : (
        <MoreBlock>
          <Button onClick={() => void signOutNow()}>{t('sellerNav.signOut')}</Button>
        </MoreBlock>
      )}
    </>
  );
}

// ---- Saturday: the hub and the three tools (stage 7.3) ----

const HubList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};

  a {
    display: flex;
    align-items: center;
    min-height: 4.5rem;
    padding: 0 ${({ theme }) => theme.spacing.lg};
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colour.surface};
    color: ${({ theme }) => theme.colour.text};
    font-size: ${({ theme }) => theme.type.size.lg};
    font-weight: ${({ theme }) => theme.type.weight.strong};
    text-decoration: none;
  }
`;
const HubTitle = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg} 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;

function HandOverHubRoute() {
  const { t } = useTranslation();
  return (
    <>
      <HubTitle>{t('sellerNav.handover')}</HubTitle>
      <HubList aria-label={t('sellerNav.saturday')}>
        <Link to="/seller/hand-over/pickup">{t('sellerNav.pickup')}</Link>
        <Link to="/seller/hand-over/delivery">{t('sellerNav.delivery')}</Link>
        <Link to="/seller/updates">{t('sellerNav.updates')}</Link>
      </HubList>
    </>
  );
}

/** A Saturday tool under a header whose back arrow returns to the hub (the tool has its own title). */
function SaturdayPage({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useCallback(() => void navigate('/seller/hand-over'), [navigate]);
  return (
    <>
      <PageHeader
        title={t('sellerNav.handover')}
        titleHidden
        backLabel={t('sellerNav.backToSaturday')}
        onBack={back}
      />
      {children}
    </>
  );
}

/** The menu, with the item editor over it on a desktop and as a page of its own on a phone. */
function MenuWorkspace() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();
  const { id } = useParams();
  const toMenu = useCallback(() => void navigate('/seller/menu'), [navigate]);
  const onEditItem = useCallback(
    (itemId: string | null) => void navigate(`/seller/menu/items/${itemId ?? 'new'}`),
    [navigate],
  );
  const onPreview = useCallback(() => void navigate('/seller/menu/preview'), [navigate]);
  const onSavedSets = useCallback(() => void navigate('/seller/menu/sets'), [navigate]);
  const onPastePost = useCallback(() => void navigate('/seller/menu/paste'), [navigate]);
  const editor =
    id === undefined ? null : (
      <ItemEditor key={id} itemId={id === 'new' ? null : id} desktop={desktop} onClose={toMenu} />
    );
  if (editor && !desktop) return editor;
  return (
    <>
      <SellerMenuScreen
        desktop={desktop}
        onPreview={onPreview}
        onEditItem={onEditItem}
        onSavedSets={onSavedSets}
        onPastePost={onPastePost}
      />
      {editor}
    </>
  );
}

function SavedSetsRoute() {
  const navigate = useNavigate();
  const toMenu = useCallback(() => void navigate('/seller/menu'), [navigate]);
  return <SavedSetsScreen onBack={toMenu} />;
}

function PastePostRoute() {
  const navigate = useNavigate();
  const toMenu = useCallback(() => void navigate('/seller/menu'), [navigate]);
  return <PastePostScreen onBack={toMenu} onDone={toMenu} />;
}

export function AppRoutes() {
  return (
    <SessionProvider>
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
        {/* Sign-in and setup sit outside the seller shell; the shell needs a finished sign-in. */}
        <Route path="/seller/setup" element={<SellerSetupRoute />} />
        <Route path="/seller/sign-in" element={<SellerSignInRoute />} />
        <Route path="/admin/setup" element={<AdminSetupRoute />} />
        <Route path="/admin/sign-in" element={<AdminSignInRoute />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminHomeRoute />
            </AdminGuard>
          }
        />
        <Route
          path="/seller"
          element={
            <SellerGuard>
              <SellerLayout />
            </SellerGuard>
          }
        >
          <Route index element={<OrdersWorkspace />} />
          <Route path="orders/:code" element={<OrdersWorkspace />} />
          <Route path="new" element={<NewOrderRoute />} />
          <Route path="cook" element={<CookRoute />} />
          <Route path="share" element={<ShareScreen />} />
          <Route
            path="settings"
            element={
              <SellerOnly>
                <SettingsRoute />
              </SellerOnly>
            }
          />
          <Route
            path="menu"
            element={
              <SellerOnly>
                <MenuWorkspace />
              </SellerOnly>
            }
          />
          <Route
            path="menu/items/:id"
            element={
              <SellerOnly>
                <MenuWorkspace />
              </SellerOnly>
            }
          />
          <Route
            path="menu/sets"
            element={
              <SellerOnly>
                <SavedSetsRoute />
              </SellerOnly>
            }
          />
          <Route
            path="menu/paste"
            element={
              <SellerOnly>
                <PastePostRoute />
              </SellerOnly>
            }
          />
          <Route path="more" element={<MoreRoute />} />
          <Route
            path="week"
            element={
              <SellerOnly>
                <WeekRoute />
              </SellerOnly>
            }
          />
          <Route
            path="images"
            element={
              <SellerOnly>
                <ImagesRoute />
              </SellerOnly>
            }
          />
          <Route
            path="chefs"
            element={
              <SellerOnly>
                <ChefsRoute />
              </SellerOnly>
            }
          />
          <Route path="labels" element={<LabelsRoute />} />
          <Route path="past-weeks" element={<PastWeeksRoute />} />
          <Route
            path="backup"
            element={
              <SellerOnly>
                <BackupRoute />
              </SellerOnly>
            }
          />
          <Route path="devices" element={<DevicesRoute />} />
          <Route path="hand-over" element={<HandOverHubRoute />} />
          <Route
            path="hand-over/pickup"
            element={
              <SaturdayPage>
                <HandOverScreen />
              </SaturdayPage>
            }
          />
          <Route
            path="hand-over/delivery"
            element={
              <SaturdayPage>
                <DeliveryRunScreen />
              </SaturdayPage>
            }
          />
          <Route
            path="updates"
            element={
              <SaturdayPage>
                <SendUpdateScreen />
              </SaturdayPage>
            }
          />
        </Route>
        {/* The preview is the customer's screen, so it sits outside the seller shell. */}
        <Route
          path="/seller/menu/preview"
          element={
            <SellerGuard>
              <SellerOnly>
                <SellerPreview />
              </SellerOnly>
            </SellerGuard>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SessionProvider>
  );
}
