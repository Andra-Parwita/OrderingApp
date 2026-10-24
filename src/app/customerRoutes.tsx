import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, Outlet, Route, useLocation, useNavigate, useParams } from 'react-router';
import { orderPath, parseOrderPath, unresolvedOrderPath } from '../../shared/orderPath';
import { isValidSlug } from '../../shared/seller';
import { readMyOrders } from '../api/device/myOrders';
import { lastKitchen } from '../api/device/lastKitchen';
import {
  BasketScreen,
  EditOrderFlow,
  DishesScreen as CustomerDishesScreen,
  HowItWorksScreen,
  MenuScreen,
  OrderPlacedScreen,
  placeReset,
  selectKitchenMissing,
  selectMenu,
  selectMenuSlug,
  useKitchenLanguages,
  type CheckoutStep,
  type CustomerRootState,
} from '../features/customer-menu';
import { menuRequested } from '../features/customer-menu/customerSlice';
import {
  MyOrdersScreen,
  OrderQrScreen,
  OrderScreen,
  selectOrderPage,
} from '../features/customer-orders';
import { readEnvironment } from '../components/install';
import { CustomerSettingsScreen, StartFreshScreen } from '../features/customer-settings';
import { CustomerShell } from './CustomerShell';
import { KitchenNotFoundPage, NotFoundPage } from './pages';

// Route wrappers: the screens only get callbacks; where they lead is decided here.

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
      void navigate(orderPath(slug, token, '/placed'), { replace: true });
      // Otherwise the next visit to the basket would see the old "placed" result and redirect.
      dispatch(placeReset());
    },
    [navigate, dispatch, slug],
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

/** An order page's kitchen from the loaded order (the token decides it, whatever the address says). */
function useOrderSlug(token: string): string | undefined {
  const page = useSelector(selectOrderPage);
  const known = page.status === 'ready' || page.status === 'expired';
  return known && page.order.token === token ? page.order.seller.slug : undefined;
}

/**
 * The order pages under their kitchen (`/:slug/o/:token/...`). If the address names another kitchen than
 * the order's own (the Worker corrects it on a full load; this covers navigation inside the app), the
 * same page under the real kitchen replaces it.
 */
function OrderScope() {
  const { slug = '', token = '' } = useParams();
  const { pathname, search, hash } = useLocation();
  const real = useOrderSlug(token);
  if (!isValidSlug(slug)) return <NotFoundPage />;
  if (real !== undefined && real !== slug) {
    return <Navigate replace to={`/${real}${pathname.slice(slug.length + 1)}${search}${hash}`} />;
  }
  return <Outlet />;
}

/** My orders: inside a kitchen's app it stays under `/<slug>`; in a browser tab it is the all-kitchens page. */
function useMyOrdersPath(slug: string | undefined): string {
  return slug !== undefined && readEnvironment().installed ? `/${slug}/my-orders` : '/my-orders';
}

/** "Order placed": the confirmation straight after ordering. Its only exit is the order page. */
function PlacedRoute() {
  const { slug = '', token = '' } = useParams();
  const navigate = useNavigate();
  const toOrder = useCallback(() => void navigate(orderPath(slug, token)), [navigate, slug, token]);
  const toQr = useCallback(
    () => void navigate(orderPath(slug, token, '/qr')),
    [navigate, slug, token],
  );
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
  const { slug = '', token = '' } = useParams();
  const back = useBackTo(orderPath(slug, token));
  if (!token) return <NotFoundPage />;
  return <OrderQrScreen key={token} token={token} onBack={back} />;
}

/**
 * The order page: status, updates, change or cancel. Opening the link adds it to My orders. Also the
 * placeholder of the old `/o/:token` while the order loads (see `LegacyOrderRoute`).
 */
function OrderRoute() {
  const { slug, token } = useParams();
  const navigate = useNavigate();
  const myOrders = useMyOrdersPath(slug);
  const back = useCallback(() => void navigate(myOrders), [navigate, myOrders]);
  // The order's own kitchen: the address's, else (old address) the one the order says.
  const own = useOrderSlug(token ?? '') ?? slug;
  const change = useCallback(
    (next: string) => void navigate(orderPath(own ?? '', next, '/edit')),
    [navigate, own],
  );
  const showQr = useCallback(
    (next: string) => void navigate(orderPath(own ?? '', next, '/qr')),
    [navigate, own],
  );
  const openMenu = useCallback((menuSlug: string) => void navigate(`/${menuSlug}`), [navigate]);
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

/**
 * An old order link opened inside the app (`/o/:token...`; a full page load never gets here, the Worker
 * redirects it first). Moves it under the order's kitchen as soon as that is known: from My orders, else
 * once the order has loaded. An unknown order keeps the order page's own "not found".
 */
function LegacyOrderRoute() {
  const { token = '' } = useParams();
  const { pathname, search, hash } = useLocation();
  const loaded = useOrderSlug(token);
  const saved = readMyOrders().find((entry) => entry.token === token)?.sellerSlug;
  const slug = loaded ?? saved;
  if (isValidSlug(slug)) {
    const sub = parseOrderPath(pathname)?.sub ?? '';
    return <Navigate replace to={`${orderPath(slug, token, sub)}${search}${hash}`} />;
  }
  return <OrderRoute />;
}

/** Change an order: the basket, then your name (the pickup place stays as ordered). */
function EditOrderRoute({ step }: Readonly<{ step: 'basket' | 'name' }>) {
  const { slug = '', token = '' } = useParams();
  const navigate = useNavigate();
  const toOrder = useCallback(() => void navigate(orderPath(slug, token)), [navigate, slug, token]);
  const toBasket = useBackTo(orderPath(slug, token, '/edit'));
  const toName = useCallback(
    () => void navigate(orderPath(slug, token, '/edit/name')),
    [navigate, slug, token],
  );
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

/**
 * Loads the kitchen's menu for the banner, theme and Menu tab: the address's kitchen (`/<slug>/settings`,
 * `/<slug>/my-orders`), else after a reload the last one this phone visited.
 */
function useKitchenMenu(slug: string | undefined) {
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const menuSlug = useSelector(selectMenuSlug);
  const wanted = slug ?? lastKitchen();
  const need = slug === undefined ? menu.status === 'idle' : menuSlug !== slug;
  useEffect(() => {
    if (need && wanted !== null) dispatch(menuRequested(wanted));
  }, [need, wanted, dispatch]);
  // Only this kitchen's own menu counts under `/<slug>/...`.
  return slug === undefined || menuSlug === slug ? menu : { status: 'loading' as const };
}

function CustomerSettingsRoute() {
  const { slug } = useParams();
  const valid = slug === undefined || isValidSlug(slug);
  const menu = useKitchenMenu(valid ? slug : undefined);
  const languages = useKitchenLanguages();
  if (!valid) return <KitchenNotFoundPage />;
  return (
    <CustomerSettingsScreen
      showLanguage={languages === 'both'}
      kitchen={menu.status === 'ready' ? menu.data.kitchen : undefined}
      startFreshPath={slug === undefined ? undefined : `/${slug}/settings/start-fresh`}
    />
  );
}

function StartFreshRoute() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const settings = slug === undefined ? '/settings' : `/${slug}/settings`;
  const toSettings = useCallback(() => void navigate(settings), [navigate, settings]);
  if (slug !== undefined && !isValidSlug(slug)) return <KitchenNotFoundPage />;
  return <StartFreshScreen onBack={toSettings} onOpenSettings={toSettings} />;
}

function MyOrdersRoute() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const valid = slug === undefined || isValidSlug(slug);
  useKitchenMenu(valid ? slug : undefined);
  // "Go to the menu": this kitchen, else the last kitchen this phone visited, else the home page.
  const back = useCallback(() => {
    const to = slug ?? lastKitchen();
    void navigate(to === null ? '/' : `/${to}`);
  }, [navigate, slug]);
  // An order opens under its kitchen: the one My orders saved, else this app's.
  const open = useCallback(
    (token: string) => {
      const own = readMyOrders().find((entry) => entry.token === token)?.sellerSlug ?? slug;
      void navigate(isValidSlug(own) ? orderPath(own, token) : unresolvedOrderPath(token));
    },
    [navigate, slug],
  );
  if (!valid) return <KitchenNotFoundPage />;
  // Inside a kitchen's installed app, only that kitchen's orders; the browser tab lists all (plan 102 Q3).
  const onlyKitchen = slug !== undefined && readEnvironment().installed ? slug : null;
  return <MyOrdersScreen onBack={back} onOpenOrder={open} onlyKitchen={onlyKitchen} />;
}

/** Customer pages share the bottom tab bar (D-039). */
export function customerRoutes() {
  return (
    <Route element={<CustomerShell />}>
      <Route path="/:slug" element={<MenuRoute />} />
      <Route path="/:slug/dishes" element={<DishesRoute />} />
      <Route path="/:slug/how-it-works" element={<HowItWorksRoute />} />
      <Route path="/:slug/basket" element={<BasketRoute step="basket" />} />
      <Route path="/:slug/basket/pickup" element={<BasketRoute step="pickup" />} />
      <Route path="/:slug/basket/name" element={<BasketRoute step="name" />} />
      {/* An order lives under its kitchen (plan 102). */}
      <Route path="/:slug/o/:token" element={<OrderScope />}>
        <Route index element={<OrderRoute />} />
        <Route path="placed" element={<PlacedRoute />} />
        <Route path="qr" element={<QrRoute />} />
        <Route path="edit" element={<EditOrderRoute step="basket" />} />
        <Route path="edit/name" element={<EditOrderRoute step="name" />} />
      </Route>
      <Route path="/:slug/my-orders" element={<MyOrdersRoute />} />
      <Route path="/:slug/settings" element={<CustomerSettingsRoute />} />
      <Route path="/:slug/settings/start-fresh" element={<StartFreshRoute />} />
      {/* The old addresses stay: links already sent, bookmarks, and the browser tab's all-kitchens pages. */}
      <Route path="/o/:token/*" element={<LegacyOrderRoute />} />
      <Route path="/my-orders" element={<MyOrdersRoute />} />
      <Route path="/settings" element={<CustomerSettingsRoute />} />
      <Route path="/settings/start-fresh" element={<StartFreshRoute />} />
    </Route>
  );
}
