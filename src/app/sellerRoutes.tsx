import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  Route,
  UNSAFE_LocationContext as LocationContext,
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
  type Location,
} from 'react-router';
import { SELLER_HELP_PATH } from '../../shared/help';
import { currentSellerSlug } from '../api/device/sellerContext';
import { fetchPreferencesCached } from '../api/cachedReads';
import { useMediaQuery } from '../components/useMediaQuery';
import { MenuPreview } from '../features/customer-menu';
import { AboutScreen } from '../features/seller-about';
import { DevicesScreen } from '../features/seller-auth';
import { CookScreen, KitchenPrintScreen } from '../features/seller-cook';
import { HelpScreen } from '../features/seller-help';
import { BackupScreen, PastWeeksScreen } from '../features/seller-history';
import { NewMenuDialog } from '../features/seller-home';
import { LabelsScreen } from '../features/seller-labels';
import {
  DishesScreen,
  MakeMenuScreen,
  NotifyBell,
  type MenuSlots,
  SavedSetsScreen,
  isWizardPath,
  parseStep,
  parseTab,
  useCloseWizard,
} from '../features/seller-menu';
import {
  ContactsBackup,
  CustomerDetailsHost,
  DeliveriesScreen,
  NewOrderScreen,
  getContact,
  OrderDetailScreen,
  OrdersTableScreen,
  openOrderLink,
  PrintOrdersScreen,
  PhoneOrdersScreen,
  parseStatusFilter,
  type StatusFilter,
} from '../features/seller-orders';
import {
  PrivateDetailScreen,
  PrivateEditorScreen,
  PrivateListScreen,
  canEditPrivate,
} from '../features/seller-private';
import { HandOverScreen, SellScreen } from '../features/seller-saturday';
import { SettingsPanes, paneHref, parsePane } from '../features/seller-settings';
import { ChefsModal, ImagesScreen, TeamScreen } from '../features/seller-setup';
import { ShareComposer, ShareScreen } from '../features/seller-share';
import { setKitchenBrand } from '../theme/kitchenBrand';
import { FullLayer } from '../ui';
import { SellerSetupRoute, SellerSignInRoute } from './AuthRoutes';
import { BrandLogo } from './BrandLogo';
import { WavingMascot } from './BrandMascot';
import { SellerGuard, SellerOnly } from './guards';
import { DESKTOP_QUERY } from './layout';
import { MorePage, MoreRoute, ToPane } from './MoreRoute';
import { SellerHomeRoute } from './SellerHomeRoute';
import { SellerLayout } from './SellerLayout';
import { SellerMenuRoute } from './SellerMenuRoute';
import { PRIVATE_MENU_SLOTS } from './privateMenuSlots';
import { useOpenKitchen } from './KitchenSwitcher';
import { mayNotify, useSession } from './session';

// The seller list's filter and search live in the URL (?status=ready&q=rina): they survive a
// reload and can be shared. Not mirrored in Redux. Opening an order keeps them in the URL, so
// the list beside the detail (desktop) and Back (phone) restore the same view.
function SellerListRoute({
  table = false,
  selectedCode,
  newOrderOpen = false,
}: Readonly<{ table?: boolean; selectedCode?: string; newOrderOpen?: boolean }>) {
  const navigate = useNavigate();
  const { me } = useSession();
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
    () => void navigate(`/seller/orders${search === '' ? '' : `?${search}`}`),
    [navigate, search],
  );
  const onNewOrder = useCallback(() => void navigate('/seller/new'), [navigate]);
  const onCloseNewOrder = useCallback(() => void navigate('/seller/orders'), [navigate]);
  const onShare = useCallback(() => void navigate('/seller/share'), [navigate]);
  const onDeliveries = useCallback(() => void navigate('/seller/deliveries'), [navigate]);
  const props = {
    filter,
    query,
    onFilterChange,
    onQueryChange,
    onOpenOrder,
    onNewOrder,
    onShare,
    onDeliveries,
  };
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
    <PhoneOrdersScreen
      {...props}
      toggles={toggles}
      onToggle={onToggle}
      headerExtra={mayNotify(me) ? <NotifyBell /> : undefined}
    />
  );
}

function DeliveriesRoute() {
  const navigate = useNavigate();
  return <DeliveriesScreen onBack={() => void navigate('/seller/orders')} />;
}

function SellerDetailRoute({ code }: Readonly<{ code: string }>) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const back = useCallback(() => void navigate(`/seller/orders${search}`), [navigate, search]);
  return <OrderDetailScreen key={code} code={code} onBack={back} />;
}

/** /seller/orders, /seller/orders/:code and /seller/new (on a phone also /seller). A phone shows one page at a time; a desktop, the table with the order in a panel. */
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

/**
 * /seller: Home on a tablet or computer (plan 039); on a phone, which has no Home, the Orders list
 * as before. A chef has no Home either: a chef on a tablet goes to Orders.
 */
function SellerIndexRoute() {
  const tablet = useMediaQuery(DESKTOP_QUERY);
  const { me } = useSession();
  if (!tablet) return <OrdersWorkspace />;
  if (me?.role === 'chef') return <Navigate to="/seller/orders" replace />;
  return <SellerHomeRoute />;
}

/** Plan 029: selling on the day. Owners and helpers; the owner may also correct the log. */
function SellRoute({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { me } = useSession();
  if (me?.role === 'chef') return <Navigate to="/seller" replace />;
  return <SellScreen canCorrect={me?.role === 'seller'} embedded={embedded} />;
}

function CookRoute() {
  return <CookScreen />;
}

/** Plan 081: private orders. The whole team reads them and moves the status; owners make, edit and cancel. */
function PrivateRoute() {
  const { me } = useSession();
  const { data } = PRIVATE_MENU_SLOTS.useMenuData();
  const places = Object.fromEntries((data?.places ?? []).map((place) => [place.id, place.place]));
  return <PrivateListScreen canEdit={canEditPrivate(me?.role)} places={places} />;
}
function PrivateDetailRoute() {
  const { code = '' } = useParams();
  const { me } = useSession();
  return (
    <PrivateDetailScreen
      code={code}
      canEdit={canEditPrivate(me?.role)}
      canChangeFulfilment={me?.role === undefined || me.role === 'seller' || me.role === 'chef'}
      openOrderLink={openOrderLink}
    />
  );
}
/** New (no code) or edit (a code): owners only, anyone else goes back to the list or the order. */
function PrivateEditorRoute() {
  const { code } = useParams();
  const { me } = useSession();
  if (!canEditPrivate(me?.role)) {
    return <Navigate to={code ? `/seller/private/${code}` : '/seller/private'} replace />;
  }
  return <PrivateEditorScreen code={code ?? null} menu={PRIVATE_MENU_SLOTS} />;
}

function NewOrderRoute() {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const toOrders = useCallback(() => void navigate('/seller/orders'), [navigate]);
  return <NewOrderScreen onBack={toOrders} onDone={toOrders} hideLanguage={desktop} />;
}

/** The kitchen's colour theme (D-064) recolours the seller app: read once on entry, set by Settings → Appearance. */
function KitchenBrandSync() {
  const { me } = useSession();
  const who = me?.sellerName ?? '';
  useEffect(() => {
    let live = true;
    void fetchPreferencesCached().then((result) => {
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
  const openKitchen = useOpenKitchen();
  const signedOut = useCallback(() => {
    void navigate('/seller/sign-in', { replace: true });
  }, [navigate]);
  const id = parsePane(pane);
  if (id === null) return <Navigate to={paneHref('kitchen')} replace />;
  return (
    <SettingsPanes
      pane={id}
      devices={
        <DevicesScreen embedded onSignedOut={signedOut} signOutHere={end} onJoined={openKitchen} />
      }
      images={<ImagesScreen embedded />}
      chefs={<TeamScreen embedded />}
      customers={<ContactsBackup />}
      backup={<BackupScreen embedded />}
    />
  );
}

/** The old week settings now live in the Make-a-menu Details; the Settings hub link goes to the Menu screen (until stage 10). */
function WeekRoute() {
  return <Navigate to="/seller/menu" replace />;
}
function LabelsRoute() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <MorePage title={t('sellerNav.labels')}>
      <LabelsScreen orderCode={params.get('order') ?? undefined} />
    </MorePage>
  );
}
/** Plan 042: print the current menu's orders on A4; reached from the Orders header or More. */
function PrintOrdersRoute() {
  const navigate = useNavigate();
  return <PrintOrdersScreen onBack={() => void navigate(-1)} />;
}
/** Plan 109: the Kitchen list as A4; reached from the Kitchen screen. */
function KitchenPrintRoute() {
  const navigate = useNavigate();
  return <KitchenPrintScreen onBack={() => void navigate(-1)} />;
}
function PastWeeksRoute() {
  const { t } = useTranslation();
  return (
    <MorePage title={t('sellerNav.pastWeeks')}>
      <PastWeeksScreen />
    </MorePage>
  );
}

/** Chefs keep the plain Devices page (they have no Settings); the owner's is the Devices pane. */
function DevicesRoute() {
  const { t } = useTranslation();
  const tablet = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();
  const { me, end } = useSession();
  const signedOut = useCallback(() => {
    void navigate('/seller/sign-in', { replace: true });
  }, [navigate]);
  if (tablet && me?.role !== 'chef' && me?.role !== 'helper') return <ToPane pane="devices" />;
  return (
    <MorePage title={t('sellerNav.devices')}>
      <DevicesScreen onSignedOut={signedOut} signOutHere={end} />
    </MorePage>
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
  const navigate = useNavigate();
  const openOrder = useCallback(
    (code: string) => void navigate(`/seller/orders/${code}`),
    [navigate],
  );
  const openPrivate = useCallback(
    (code: string) => void navigate(`/seller/private/${code}`),
    [navigate],
  );
  return (
    <HandOverScreen
      phone={phone}
      addressOf={addressOf}
      onOpenOrder={openOrder}
      onOpenPrivate={openPrivate}
    />
  );
}

/** Screens of other features that the menu wizard shows: the customer's menu, the post, the New menu dialog. */
const MENU_SLOTS: MenuSlots = {
  preview: ({ slug, menu }) => <MenuPreview slug={slug} menu={menu} />,
  share: ({ onGoToOrders }) => <ShareComposer withLink onGoToOrders={onGoToOrders} />,
  chefs: ({ onClose }) => <ChefsModal onClose={onClose} />,
  newMenu: (props) => <NewMenuDialog {...props} />,
  onTheDay: () => <SellRoute embedded />,
};

/**
 * Make a menu (the wizard) and a live menu's tabs: /seller/menu/make/:step and /seller/menu/edit/:step.
 * A layer over the screen it was opened from (plan 037): that screen stays rendered and its tab lit.
 */
function MakeMenuRoute({
  mode,
  step,
}: Readonly<{ mode: 'make' | 'edit'; step: string | undefined }>) {
  const name = mode === 'make' ? parseStep(step) : parseTab(step);
  if (name === null) return <Navigate to="/seller/menu" replace />;
  return <MakeMenuScreen mode={mode} step={name} slots={MENU_SLOTS} layered />;
}

/** The address as typed, while the screens behind a wizard layer see the background address. */
export const RealLocation = createContext<Location | null>(null);

/** Shown for a wizard opened with no background (a link, a refresh in a new tab): over Menu. */
export const MENU_BACKGROUND: Location = {
  pathname: '/seller/menu',
  search: '',
  hash: '',
  state: null,
  key: 'menu',
};

function WizardLayerContent({ mode, step }: Readonly<{ mode: 'make' | 'edit'; step: string }>) {
  const { t } = useTranslation('sellerMenu');
  const close = useCloseWizard();
  // Plan 103 fix 8: a live menu's edit session is a sheet with its own header and footer.
  if (mode === 'edit') return <MakeMenuRoute mode={mode} step={step} />;
  return (
    <FullLayer label={t('make.layer')} closeLabel={t('close')} onClose={close}>
      <MakeMenuRoute mode={mode} step={step} />
    </FullLayer>
  );
}

/** The wizard layer, on a tablet or computer: rendered inside the seller guard, over the background. */
function WizardLayerHost() {
  const real = useContext(RealLocation);
  const tablet = useMediaQuery(DESKTOP_QUERY);
  const navigationType = useNavigationType();
  if (!real || !isWizardPath(real.pathname)) return null;
  const match =
    matchPath('/seller/menu/make/:step', real.pathname) ??
    matchPath('/seller/menu/edit/:step', real.pathname);
  if (!match) return null;
  const mode = real.pathname.startsWith('/seller/menu/make/') ? 'make' : 'edit';
  // The wizard is for a tablet; the edit sheet is also a phone's full screen.
  if (!tablet && mode === 'make') return null;
  return (
    // The layer reads the real address (and its state), not the background the shell is showing.
    <LocationContext.Provider value={{ location: real, navigationType }}>
      <SellerOnly>
        <WizardLayerContent key={mode} mode={mode} step={match.params.step ?? ''} />
      </SellerOnly>
    </LocationContext.Provider>
  );
}

/** Public seller pages: Help at a hard-to-guess address, setup and sign-in, outside the seller shell. */
export function sellerEntryRoutes() {
  return (
    <>
      {/* Sign-in and setup sit outside the seller shell; the shell needs a finished sign-in. */}
      {/* Plan 058, D-095: public Help at a hard-to-guess address, outside the seller shell; the same content is also at /seller/help inside the seller layout (plan 079). */}
      <Route
        path={SELLER_HELP_PATH}
        element={<HelpScreen logo={<BrandLogo onBeige />} mascot={<WavingMascot />} />}
      />
      <Route path="/seller/setup" element={<SellerSetupRoute />} />
      <Route path="/seller/sign-in" element={<SellerSignInRoute />} />
    </>
  );
}

/** The signed-in seller shell and its pages. */
export function sellerRoutes() {
  return (
    <Route
      path="/seller"
      element={
        <SellerGuard>
          <KitchenBrandSync />
          <SellerLayout />
          <WizardLayerHost />
          <CustomerDetailsHost />
        </SellerGuard>
      }
    >
      <Route index element={<SellerIndexRoute />} />
      <Route path="orders" element={<OrdersWorkspace />} />
      <Route path="orders/print" element={<PrintOrdersRoute />} />
      <Route path="orders/:code" element={<OrdersWorkspace />} />
      <Route path="new" element={<OrdersWorkspace />} />
      <Route path="deliveries" element={<DeliveriesRoute />} />
      <Route path="cook" element={<CookRoute />} />
      <Route path="cook/print" element={<KitchenPrintRoute />} />
      <Route path="private" element={<PrivateRoute />} />
      <Route path="private/new" element={<PrivateEditorRoute />} />
      <Route path="private/:code" element={<PrivateDetailRoute />} />
      <Route path="private/:code/edit" element={<PrivateEditorRoute />} />
      <Route path="sell" element={<SellRoute />} />
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
      <Route path="menu" element={<SellerMenuRoute slots={MENU_SLOTS} />} />
      <Route
        path="menu/dishes"
        element={
          <SellerOnly>
            <DishesScreen slots={MENU_SLOTS} />
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
      {/* Plan 079: Help inside the seller layout; every role. */}
      <Route path="help" element={<HelpScreen embedded />} />
      {/* Plan 075: About ShaggyBobo and the release notes; every role. */}
      <Route
        path="about"
        element={<AboutScreen logo={<BrandLogo />} wideQuery={DESKTOP_QUERY} />}
      />
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
  );
}
