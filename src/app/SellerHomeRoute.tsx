import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { SellerHome, type GoTarget, type HomeData } from '../features/seller-home';
import { useLiveOrders } from '../features/seller-orders';
import { useMenuData } from '../features/seller-menu/menuShared';
import { useMenuWizard } from '../features/seller-menu';

// Home on a tablet (/seller): loads what the Menu screens load, and wires Home's actions to the
// same ops the Menu screen uses. Home itself (src/features/seller-home) imports no other feature.

const GO: Readonly<Record<GoTarget, string>> = {
  orders: '/seller/orders',
  kitchen: '/seller/cook',
  handover: '/seller/hand-over',
  menu: '/seller/menu',
  settings: '/seller/settings/kitchen',
};

export function SellerHomeRoute() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, status } = useMenuData();
  // Make a menu and Continue open the wizard as a layer over Home (plan 037).
  const wizard = useMenuWizard();
  const go = useCallback(
    (target: GoTarget, search?: string) =>
      void navigate(search ? `${GO[target]}?${search}` : GO[target]),
    [navigate],
  );
  const orders = useLiveOrders();

  if (!data) return <main>{status}</main>;
  const home: HomeData = {
    view: data.view,
    past: data.past,
    sets: data.sets,
    defaults: data.prefs.menuDefaults,
    ...(orders ? { orders } : {}),
  };
  return (
    <SellerHome
      data={home}
      lang={i18n.resolvedLanguage === 'id' ? 'id' : 'en'}
      onStartMenu={wizard.start}
      startFailed={wizard.failed}
      onContinue={wizard.open}
      onGo={go}
    />
  );
}
