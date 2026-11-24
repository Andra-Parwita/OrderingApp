import { Route, Routes, useLocation } from 'react-router';
import { useMediaQuery } from '../components/useMediaQuery';
import { registerAdminI18n } from '../features/admin';
import { registerSellerAuthI18n } from '../features/seller-auth';
import { registerCookI18n } from '../features/seller-cook';
import { registerSellerHelpI18n } from '../features/seller-help';
import { registerSellerHistoryI18n } from '../features/seller-history';
import { registerSellerLabelsI18n } from '../features/seller-labels';
import { isWizardPath, registerSellerMenuI18n, wizardBackground } from '../features/seller-menu';
import { registerSellerI18n } from '../features/seller-orders';
import { registerPrivateI18n } from '../features/seller-private';
import { registerSellerSaturdayI18n } from '../features/seller-saturday';
import { registerSettingsI18n } from '../features/seller-settings';
import { registerSellerSetupI18n } from '../features/seller-setup';
import { registerShareI18n } from '../features/seller-share';
import { adminRoutes } from './adminRoutes';
import { DESKTOP_QUERY } from './layout';
import { NotFoundPage } from './pages';
import { SessionProvider } from './session';
import {
  MENU_BACKGROUND,
  ORDERS_BACKGROUND,
  RealLocation,
  sellerEntryRoutes,
  sellerRoutes,
} from './sellerRoutes';

// Plan 119: the seller and admin strings load with this chunk (i18n is ready before the app renders).
registerSellerI18n();
registerCookI18n();
registerPrivateI18n();
registerShareI18n();
registerSettingsI18n();
registerSellerMenuI18n();
registerSellerSetupI18n();
registerSellerHelpI18n();
registerSellerLabelsI18n();
registerSellerHistoryI18n();
registerSellerAuthI18n();
registerAdminI18n();
registerSellerSaturdayI18n();

/** The seller and admin area: one lazy chunk, so customers never download it. */
export function StaffArea() {
  const location = useLocation();
  const tablet = useMediaQuery(DESKTOP_QUERY);
  // A wizard address shows its background screen in the shell and the wizard in a layer.
  const background = isWizardPath(location.pathname)
    ? (wizardBackground(location.state) ?? (tablet ? MENU_BACKGROUND : ORDERS_BACKGROUND))
    : undefined;
  return (
    <SessionProvider>
      <RealLocation.Provider value={location}>
        {/* Only a wizard overrides the location: react-router reports every overridden location as a Pop, which would stop the pages sliding in. */}
        {/* Plan 134: on a phone the location is always given, so the Orders screen under a wizard keeps its state (its open menu layer) when the wizard opens and closes. */}
        <Routes location={tablet ? background : (background ?? location)}>
          {sellerEntryRoutes()}
          {adminRoutes()}
          {sellerRoutes()}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RealLocation.Provider>
    </SessionProvider>
  );
}
