import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, useLocation, useNavigate, useParams } from 'react-router';
import { isValidSlug } from '../../shared/seller';
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
  useKitchenLanguages,
  type CheckoutStep,
  type CustomerRootState,
} from '../features/customer-menu';
import { menuRequested } from '../features/customer-menu/customerSlice';
import { MyOrdersScreen, OrderQrScreen, OrderScreen } from '../features/customer-orders';
import { CustomerSettingsScreen } from '../features/customer-settings';
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

/** After a reload no kitchen is loaded: load the last one this phone visited, for the banner, theme and Menu tab. */
function useLastKitchenMenu() {
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const idle = menu.status === 'idle';
  useEffect(() => {
    const slug = lastKitchen();
    if (idle && slug !== null) dispatch(menuRequested(slug));
  }, [idle, dispatch]);
  return menu;
}

function CustomerSettingsRoute() {
  const menu = useLastKitchenMenu();
  return (
    <CustomerSettingsScreen
      showLanguage={useKitchenLanguages() === 'both'}
      kitchen={menu.status === 'ready' ? menu.data.kitchen : undefined}
    />
  );
}

function MyOrdersRoute() {
  const navigate = useNavigate();
  useLastKitchenMenu();
  // "Go to the menu": the last kitchen this phone visited, else the home page.
  const back = useCallback(() => {
    const slug = lastKitchen();
    void navigate(slug === null ? '/' : `/${slug}`);
  }, [navigate]);
  const open = useCallback((token: string) => void navigate(`/o/${token}`), [navigate]);
  return <MyOrdersScreen onBack={back} onOpenOrder={open} />;
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
      <Route path="/o/:token" element={<OrderRoute />} />
      <Route path="/o/:token/placed" element={<PlacedRoute />} />
      <Route path="/o/:token/qr" element={<QrRoute />} />
      <Route path="/o/:token/edit" element={<EditOrderRoute step="basket" />} />
      <Route path="/o/:token/edit/name" element={<EditOrderRoute step="name" />} />
      <Route path="/my-orders" element={<MyOrdersRoute />} />
      <Route path="/settings" element={<CustomerSettingsRoute />} />
    </Route>
  );
}
