import { Suspense, lazy, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { styled } from 'styled-components';
import { lastKitchen } from '../api/device/lastKitchen';
import { currentSellerSlug } from '../api/device/sellerContext';
import { fetchPreferences } from '../api/menus';
import { setKitchenBrand } from '../theme/kitchenBrand';
import { useMediaQuery } from '../components/useMediaQuery';
import {
  BasketScreen,
  EditOrderFlow,
  DishesScreen as CustomerDishesScreen,
  HowItWorksScreen,
  MenuPreview,
  MenuScreen,
  OrderPlacedScreen,
  placeReset,
  selectKitchenMissing,
  type CheckoutStep,
  type CustomerRootState,
} from '../features/customer-menu';
import { MyOrdersScreen, OrderQrScreen, OrderScreen } from '../features/customer-orders';
import { CustomerSettingsScreen } from '../features/customer-settings';
import { CookScreen } from '../features/seller-cook';
import {
  ContactsBackup,
  NewOrderScreen,
  PhoneLanguageRow,
  PhoneMoreNote,
  getContact,
  OrderDetailScreen,
  OrdersTableScreen,
  PhoneOrdersScreen,
  parseStatusFilter,
  type StatusFilter,
} from '../features/seller-orders';
import { BackupScreen, PastWeeksScreen } from '../features/seller-history';
import { LabelsScreen } from '../features/seller-labels';
import {
  DishesScreen,
  MakeMenuScreen,
  type MenuSlots,
  MenuScreen as SellerMenuScreen,
  SavedSetsScreen,
  parseStep,
  parseTab,
} from '../features/seller-menu';
import { SettingsPanes, paneHref, parsePane, type PaneId } from '../features/seller-settings';
import { DevicesScreen } from '../features/seller-auth';
import { HandOverScreen } from '../features/seller-saturday';
import { ChefsScreen, ImagesScreen } from '../features/seller-setup';
import { ShareComposer, ShareScreen } from '../features/seller-share';
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
import { MoreSwitchPerson } from './SwitchPerson';

// Route wrappers: the screens only get callbacks; where they lead is decided here.

// Dev only (dropped from a production build): /__fixtures/:screenId renders a customer design
// screen from fixtures, for the design-compare check.
const FixturesPage = import.meta.env.DEV
  ? lazy(() => import('../harness/customerFixtures/FixturesPage'))
  : null;

/** True when the server said this kitchen does not exist. */
function useKitchenMissing(slug: string): boolean {
  return useSelector((state: CustomerRootState) => selectKitchenMissing(state, slug));
}

function MenuRoute() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toDishes = useCallback(() => void navigate(`/${slug}/dishes`), [navigate, slug]);
  const toHow = useCallback(() => void navigate(`/${slug}/how-it-works`), [navigate, slug]);
  const missing = useKitchenMissing(slug);
  if (!isValidSlug(slug) || missing) return <KitchenNotFoundPage />;
  return <MenuScreen slug={slug} onSeeDishes={toDishes} onHowItWorks={toHow} />;
}

/** Back goes to where the customer came from; opened directly, it goes to the menu. */
function useBackToMenu(slug: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    void (location.key === 'default' ? navigate(`/${slug}`, { replace: true }) : navigate(-1));
  }, [navigate, location.key, slug]);
}

function DishesRoute() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const back = useBackToMenu(slug);
  const toBasket = useCallback(() => void navigate(`/${slug}/basket`), [navigate, slug]);
  const missing = useKitchenMissing(slug);
  if (!isValidSlug(slug) || missing) return <KitchenNotFoundPage />;
  return <CustomerDishesScreen slug={slug} onBack={back} onViewBasket={toBasket} />;
}

function HowItWorksRoute() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const back = useBackToMenu(slug);
  // Replace, so Back from the dishes returns to the menu and not to this page.
  const toDishes = useCallback(
    () => void navigate(`/${slug}/dishes`, { replace: true }),
    [navigate, slug],
  );
  const missing = useKitchenMissing(slug);
  if (!isValidSlug(slug) || missing) return <KitchenNotFoundPage />;
  return <HowItWorksScreen slug={slug} onBack={back} onSeeDishes={toDishes} />;
}

/** Back goes to where the customer came from; opened directly, it goes to `fallback`. */
function useBackTo(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    void (location.key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1));
  }, [navigate, location.key, fallback]);
}

/** The checkout pages: the basket, the pickup place and your name (spec §4.2). */
function BasketRoute({ step }: Readonly<{ step: CheckoutStep }>) {
  const { slug = '' } = useParams();
  const missing = useKitchenMissing(slug);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const base = `/${slug}/basket`;
  // From the dishes (or the menu when opened directly); the pickup and name pages go back to the basket.
  const back = useBackTo(step === 'basket' ? `/${slug}` : base);
  const next = useCallback(() => void navigate(`${base}/name`), [navigate, base]);
  const changePlace = useCallback(() => void navigate(`${base}/pickup`), [navigate, base]);
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
  return (
    <BasketScreen
      slug={slug}
      step={step}
      onBack={back}
      onNext={next}
      onChangePlace={changePlace}
      onToBasket={back}
      onPlaced={placed}
    />
  );
}

/** "Order placed": the confirmation straight after ordering. Its only exit is the order page. */
function PlacedRoute() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toOrder = useCallback(() => void navigate(`/o/${token ?? ''}`), [navigate, token]);
  const toQr = useCallback(() => void navigate(`/o/${token ?? ''}/qr`), [navigate, token]);
  if (!token) return <NotFoundPage />;
  return (
    <OrderPlacedScreen
      key={token}
      token={token}
      onChange={toOrder}
      onViewOrder={toOrder}
      onShowQr={toQr}
    />
  );
}

/** The full-screen QR to show at pickup. */
function QrRoute() {
  const { token } = useParams();
  const back = useBackTo(`/o/${token ?? ''}`);
  if (!token) return <NotFoundPage />;
  return <OrderQrScreen key={token} token={token} onBack={back} />;
}

/** The order page: status, updates, change or cancel. Opening the link adds it to My orders. */
function OrderRoute() {
  const { token } = useParams();
  const navigate = useNavigate();
  const back = useCallback(() => void navigate('/my-orders'), [navigate]);
  const change = useCallback((next: string) => void navigate(`/o/${next}/edit`), [navigate]);
  const showQr = useCallback((next: string) => void navigate(`/o/${next}/qr`), [navigate]);
  const openMenu = useCallback((slug: string) => void navigate(`/${slug}`), [navigate]);
  if (!token) return <NotFoundPage />;
  return (
    <OrderScreen
      key={token}
      token={token}
      onBack={back}
      onChange={change}
      onShowQr={showQr}
      onOpenMenu={openMenu}
    />
  );
}

/** Change an order: the basket, then your name (the pickup place stays as ordered). */
function EditOrderRoute({ step }: Readonly<{ step: 'basket' | 'name' }>) {
  const { token } = useParams();
  const navigate = useNavigate();
  const toOrder = useCallback(() => void navigate(`/o/${token ?? ''}`), [navigate, token]);
  const toBasket = useBackTo(`/o/${token ?? ''}/edit`);
  const toName = useCallback(() => void navigate(`/o/${token ?? ''}/edit/name`), [navigate, token]);
  if (!token) return <NotFoundPage />;
  return (
    <EditOrderFlow token={token}>
      <BasketScreen
        key={token}
        step={step}
        editToken={token}
        onBack={step === 'basket' ? toOrder : toBasket}
        onNext={toName}
        onToBasket={toBasket}
        onPlaced={toOrder}
        onUpdated={toOrder}
      />
    </EditOrderFlow>
  );
}

function MyOrdersRoute() {
  const navigate = useNavigate();
  // "Go to the menu": the last kitchen this phone visited, else the home page.
  const back = useCallback(() => {
    const slug = lastKitchen();
    void navigate(slug === null ? '/' : `/${slug}`);
  }, [navigate]);
  const open = useCallback((token: string) => void navigate(`/o/${token}`), [navigate]);
  return <MyOrdersScreen onBack={back} onOpenOrder={open} />;
}

// The seller list's filter and search live in the URL (?status=ready&q=rina): they survive a
// reload and can be shared. Not mirrored in Redux. Opening an order keeps them in the URL, so
// the list beside the detail (desktop) and Back (phone) restore the same view.
function SellerListRoute({
  table = false,
  selectedCode,
  newOrderOpen = false,
}: Readonly<{ table?: boolean; selectedCode?: string; newOrderOpen?: boolean }>) {
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
  const changedOn = params.get('changed') === '1';
  const unpaidOn = params.get('unpaid') === '1';
  const toggles = useMemo(() => ({ changed: changedOn, unpaid: unpaidOn }), [changedOn, unpaidOn]);
  const onToggle = useCallback(
    (key: 'changed' | 'unpaid') => setParam(key, toggles[key] ? '0' : '1', '0'),
    [setParam, toggles],
  );
  const onCloseOrder = useCallback(
    () => void navigate(`/seller${search === '' ? '' : `?${search}`}`),
    [navigate, search],
  );
  const onNewOrder = useCallback(() => void navigate('/seller/new'), [navigate]);
  const onCloseNewOrder = useCallback(() => void navigate('/seller'), [navigate]);
  const onShare = useCallback(() => void navigate('/seller/share'), [navigate]);
  const props = { filter, query, onFilterChange, onQueryChange, onOpenOrder, onNewOrder, onShare };
  return table ? (
    <OrdersTableScreen
      {...props}
      selectedCode={selectedCode}
      toggles={toggles}
      onToggle={onToggle}
      onCloseOrder={onCloseOrder}
      newOrderOpen={newOrderOpen}
      onCloseNewOrder={onCloseNewOrder}
    />
  ) : (
    <PhoneOrdersScreen {...props} toggles={toggles} onToggle={onToggle} />
  );
}

function SellerDetailRoute({ code }: Readonly<{ code: string }>) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const back = useCallback(() => void navigate(`/seller${search}`), [navigate, search]);
  return <OrderDetailScreen key={code} code={code} onBack={back} />;
}

/** /seller and /seller/orders/:code. A phone shows one page at a time; a desktop, the table with the order in a panel. */
function OrdersWorkspace() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { code } = useParams();
  const isNew = useMatch('/seller/new') !== null;
  if (!desktop) {
    if (isNew) return <NewOrderRoute />;
    return code ? <SellerDetailRoute code={code} /> : <SellerListRoute />;
  }
  // The same screen for the list, the order beside it and New order (a slide-over), so opening one
  // does not reload the list.
  return <SellerListRoute table selectedCode={code} newOrderOpen={isNew} />;
}

function CookRoute() {
  return <CookScreen />;
}

function NewOrderRoute() {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const toOrders = useCallback(() => void navigate('/seller'), [navigate]);
  return <NewOrderScreen onBack={toOrders} onDone={toOrders} hideLanguage={desktop} />;
}

const MoreBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
// The sign-out button at the foot of More: padded on every side so it clears the tab bar.
const SignOutBlock = styled(MoreBlock)`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xl};
`;
const PhoneBlocks = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px
    ${({ theme }) => theme.spacing.xl};
`;

/** The kitchen's colour theme (D-064) recolours the seller app: read once on entry, set by Settings → Appearance. */
function KitchenBrandSync() {
  const { me } = useSession();
  const who = me?.sellerName ?? '';
  useEffect(() => {
    let live = true;
    void fetchPreferences(undefined, currentSellerSlug()).then((result) => {
      if (live && result.ok) setKitchenBrand(result.data.preferences.theme);
    });
    return () => {
      live = false;
      // Leaving the seller app: the customer pages come in stage 12.
      setKitchenBrand('onde');
    };
  }, [who]);
  return null;
}

/** Settings: /seller/settings/:pane (owner, tablet). The Devices pane needs the session, so it is made here. */
function SettingsRoute() {
  const { pane } = useParams();
  const navigate = useNavigate();
  const { end } = useSession();
  const signedOut = useCallback(() => {
    void navigate('/seller/sign-in', { replace: true });
  }, [navigate]);
  const id = parsePane(pane);
  if (id === null) return <Navigate to={paneHref('kitchen')} replace />;
  return (
    <SettingsPanes
      pane={id}
      devices={<DevicesScreen embedded onSignedOut={signedOut} signOutHere={end} />}
      images={<ImagesScreen embedded />}
      chefs={<ChefsScreen embedded />}
      backup={<BackupScreen embedded />}
    />
  );
}

/** An old settings route: the owner goes to the pane that now holds it. */
function ToPane({ pane }: Readonly<{ pane: PaneId }>) {
  return <Navigate to={paneHref(pane)} replace />;
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

/** The old week settings now live in the Make-a-menu Details; the Settings hub link goes to the Menu screen (until stage 10). */
function WeekRoute() {
  return <Navigate to="/seller/menu" replace />;
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

/** Chefs keep the plain Devices page (they have no Settings); the owner's is the Devices pane. */
function DevicesRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, end } = useSession();
  const signedOut = useCallback(() => {
    void navigate('/seller/sign-in', { replace: true });
  }, [navigate]);
  if (me?.role !== 'chef') return <ToPane pane="devices" />;
  return (
    <MorePage title={t('sellerNav.devices')}>
      <DevicesScreen onSignedOut={signedOut} signOutHere={end} />
    </MorePage>
  );
}

/** The phone's More tab. On a tablet the owner's More is Settings (chefs have no Settings and keep More). */
function MoreRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, end } = useSession();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const links = MORE_LINKS.filter(
    ([key]) => (me?.role !== 'chef' || !CHEF_HIDDEN.has(key)) && (key !== 'devices' || me !== null),
  );
  const signOutNow = useCallback(async () => {
    await end();
    void navigate('/seller/sign-in', { replace: true });
  }, [end, navigate]);
  if (desktop && me?.role !== 'chef') return <ToPane pane="kitchen" />;
  // Phone: Switch person, language, sign out, where the rest lives, and the contacts on this phone.
  if (!desktop) {
    return (
      <>
        <PageHeader title={t('sellerNav.moreTitle')} />
        <PhoneBlocks>
          <MoreSwitchPerson />
          <PhoneLanguageRow />
          {me === null ? null : (
            <Button fullWidth onClick={() => void signOutNow()}>
              {t('sellerNav.signOut')}
            </Button>
          )}
          <PhoneMoreNote />
          <ContactsBackup />
        </PhoneBlocks>
      </>
    );
  }
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
        <SignOutBlock>
          <Button onClick={() => void signOutNow()}>{t('sellerNav.signOut')}</Button>
        </SignOutBlock>
      )}
    </>
  );
}

/** Pickup & delivery: /seller/hand-over. A phone shows one place at a time. */
function HandOverRoute() {
  const phone = !useMediaQuery(DESKTOP_QUERY);
  // The delivery address lives on the seller's phone only (D-059): given here, never read on a tablet.
  const addressOf = useCallback(
    (code: string) => getContact(currentSellerSlug(), code)?.address || undefined,
    [],
  );
  return <HandOverScreen phone={phone} addressOf={addressOf} />;
}

/** Screens of other features that the menu wizard shows: the customer's menu and the WhatsApp post. */
const MENU_SLOTS: MenuSlots = {
  preview: ({ slug, menu }) => <MenuPreview slug={slug} menu={menu} />,
  share: ({ onGoToOrders }) => <ShareComposer withLink onGoToOrders={onGoToOrders} />,
};

/** Make a menu (the wizard) and a live menu's tabs: /seller/menu/make/:step and /seller/menu/edit/:step. */
function MakeMenuRoute({ mode }: Readonly<{ mode: 'make' | 'edit' }>) {
  const { step } = useParams();
  const name = mode === 'make' ? parseStep(step) : parseTab(step);
  if (name === null) return <Navigate to="/seller/menu" replace />;
  return <MakeMenuScreen mode={mode} step={name} slots={MENU_SLOTS} />;
}

export function AppRoutes() {
  return (
    <SessionProvider>
      <Routes>
        {FixturesPage ? (
          <Route
            path="/__fixtures/:screenId"
            element={
              <Suspense fallback={null}>
                <FixturesPage />
              </Suspense>
            }
          />
        ) : null}
        {/* Customer pages share the bottom tab bar (D-039). */}
        <Route element={<CustomerShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/:slug" element={<MenuRoute />} />
          <Route path="/:slug/dishes" element={<DishesRoute />} />
          <Route path="/:slug/how-it-works" element={<HowItWorksRoute />} />
          <Route path="/:slug/basket" element={<BasketRoute step="basket" />} />
          <Route path="/:slug/basket/pickup" element={<BasketRoute step="pickup" />} />
          <Route path="/:slug/basket/name" element={<BasketRoute step="name" />} />
          <Route path="/o/:token" element={<OrderRoute />} />
          <Route path="/o/:token/placed" element={<PlacedRoute />} />
          <Route path="/o/:token/qr" element={<QrRoute />} />
          <Route path="/o/:token/edit" element={<EditOrderRoute step="basket" />} />
          <Route path="/o/:token/edit/name" element={<EditOrderRoute step="name" />} />
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
              <KitchenBrandSync />
              <SellerLayout />
            </SellerGuard>
          }
        >
          <Route index element={<OrdersWorkspace />} />
          <Route path="orders/:code" element={<OrdersWorkspace />} />
          <Route path="new" element={<OrdersWorkspace />} />
          <Route path="cook" element={<CookRoute />} />
          <Route path="share" element={<ShareScreen />} />
          <Route
            path="settings"
            element={
              <SellerOnly>
                <ToPane pane="kitchen" />
              </SellerOnly>
            }
          />
          <Route
            path="settings/:pane"
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
                <SellerMenuScreen />
              </SellerOnly>
            }
          />
          <Route
            path="menu/make/:step"
            element={
              <SellerOnly>
                <MakeMenuRoute mode="make" />
              </SellerOnly>
            }
          />
          <Route
            path="menu/edit/:step"
            element={
              <SellerOnly>
                <MakeMenuRoute mode="edit" />
              </SellerOnly>
            }
          />
          <Route
            path="menu/dishes"
            element={
              <SellerOnly>
                <DishesScreen />
              </SellerOnly>
            }
          />
          <Route
            path="menu/sets"
            element={
              <SellerOnly>
                <SavedSetsScreen />
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
                <ToPane pane="kitchen" />
              </SellerOnly>
            }
          />
          <Route
            path="chefs"
            element={
              <SellerOnly>
                <ToPane pane="chefs" />
              </SellerOnly>
            }
          />
          <Route path="labels" element={<LabelsRoute />} />
          <Route path="past-weeks" element={<PastWeeksRoute />} />
          <Route
            path="backup"
            element={
              <SellerOnly>
                <ToPane pane="backup" />
              </SellerOnly>
            }
          />
          <Route path="devices" element={<DevicesRoute />} />
          <Route path="hand-over" element={<HandOverRoute />} />
          {/* Old Saturday routes: the one Pickup & delivery screen holds them now. */}
          <Route path="hand-over/pickup" element={<Navigate to="/seller/hand-over" replace />} />
          <Route path="hand-over/delivery" element={<Navigate to="/seller/hand-over" replace />} />
          <Route path="updates" element={<Navigate to="/seller/hand-over" replace />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SessionProvider>
  );
}
