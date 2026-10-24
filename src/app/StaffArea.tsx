import { Route, Routes, useLocation } from 'react-router';
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
import { NotFoundPage } from './pages';
import { SessionProvider } from './session';
import { MENU_BACKGROUND, RealLocation, sellerEntryRoutes, sellerRoutes } from './sellerRoutes';

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
  // A wizard address shows its background screen in the shell and the wizard in a layer.
  const background = isWizardPath(location.pathname)
    ? (wizardBackground(location.state) ?? MENU_BACKGROUND)
    : undefined;
  return (
    <SessionProvider>
      <RealLocation.Provider value={location}>
        {/* Only a wizard overrides the location: react-router reports every overridden location as a Pop, which would stop the pages sliding in. */}
        <Routes location={background}>
          {sellerEntryRoutes()}
          {adminRoutes()}
          {sellerRoutes()}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RealLocation.Provider>
    </SessionProvider>
  );
}
